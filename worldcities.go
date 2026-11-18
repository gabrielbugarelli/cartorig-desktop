//go:build !installer

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Full Natural Earth 10m Populated Places data. Offline functionality is guaranteed
// only after it has been successfully cached, or when bundled by the build script.
// The smaller bundled 244-point city catalogue always works offline.
const globalCitiesURL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson"
const cityMaxSize = 80 << 20

var cityMu sync.Mutex

func cityPath() (string, error) {
	d, e := geoPackDir()
	if e != nil {
		return "", e
	}
	return filepath.Join(filepath.Dir(d), "cities-world.geojson"), nil
}
func cityInstalled() (string, bool) {
	if f, e := appFiles.Open("assets/geodata/cities_world_full.geojson"); e == nil {
		f.Close()
		return "assets/geodata/cities_world_full.geojson", true
	}
	path, e := cityPath()
	if e != nil {
		return "", false
	}
	proof := cachedDataProof("cities", path)
	return path, proof.Valid
}
func citySource() string {
	if s := os.Getenv("CARTORIG_CITIES_SOURCE_URL"); s != "" {
		return s
	}
	return globalCitiesURL
}
func validateCitiesGeoJSON(data []byte) (int, error) {
	var collection struct {
		Type     string `json:"type"`
		Features []struct {
			Type       string         `json:"type"`
			Properties map[string]any `json:"properties"`
			Geometry   struct {
				Type        string    `json:"type"`
				Coordinates []float64 `json:"coordinates"`
			} `json:"geometry"`
		} `json:"features"`
	}
	if err := json.Unmarshal(data, &collection); err != nil {
		return 0, fmt.Errorf("invalid GeoJSON: %w", err)
	}
	if collection.Type != "FeatureCollection" || len(collection.Features) < 500 || len(collection.Features) > 20000 {
		return 0, errors.New("city dataset must contain 500–20,000 real features")
	}
	countries := make(map[string]bool)
	foundMunich := false
	for _, f := range collection.Features {
		if f.Type != "Feature" || f.Geometry.Type != "Point" || len(f.Geometry.Coordinates) < 2 || f.Geometry.Coordinates[0] < -180 || f.Geometry.Coordinates[0] > 180 || f.Geometry.Coordinates[1] < -90 || f.Geometry.Coordinates[1] > 90 {
			return 0, errors.New("invalid coordinate or point geometry")
		}
		p := f.Properties
		name, _ := p["name"].(string)
		if name == "" {
			name, _ = p["NAME"].(string)
		}
		country, _ := p["adm0name"].(string)
		if country == "" {
			country, _ = p["ADM0NAME"].(string)
		}
		if name == "" || country == "" {
			return 0, errors.New("missing city name or parent country")
		}
		countries[country] = true
		if strings.EqualFold(name, "Munich") || strings.EqualFold(name, "München") {
			foundMunich = true
		}
	}
	if len(countries) < 75 || !foundMunich {
		return 0, errors.New("city data incomplete: missing countries or Munich")
	}
	return len(collection.Features), nil
}
func cityStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(healthForDataset("cities"))
}

func cityDataHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	path, ok := cityInstalled()
	if !ok {
		http.Error(w, "world city dataset not installed", 404)
		return
	}
	w.Header().Set("Content-Type", "application/geo+json")
	w.Header().Set("Cache-Control", "no-store")
	if strings.HasPrefix(path, "assets/") {
		b, e := appFiles.ReadFile(path)
		if e != nil {
			http.Error(w, "embedded city dataset unavailable", 500)
			return
		}
		_, _ = w.Write(b)
		return
	}
	http.ServeFile(w, r, path)
}
func cityInstallHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", 405)
		return
	}
	cityMu.Lock()
	defer cityMu.Unlock()
	path, already := cityInstalled()
	force := r.URL.Query().Get("repair") == "1"
	if already && force && strings.HasPrefix(path, "assets/") {
		http.Error(w, "bundled city dataset cannot be replaced in place", 409)
		return
	}
	if already && !force {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"installed":true,"already_installed":true}`))
		return
	}
	source := citySource()
	if !strings.HasPrefix(source, "https://") && !(os.Getenv("CARTORIG_CITIES_SOURCE_URL") != "" && strings.HasPrefix(source, "http://127.0.0.1:")) {
		http.Error(w, "invalid city source", 500)
		return
	}
	client := &http.Client{Timeout: 180 * time.Second}
	resp, e := client.Get(source)
	if e != nil {
		http.Error(w, "could not obtain official world city dataset: "+e.Error(), 503)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		http.Error(w, fmt.Sprintf("city source returned HTTP %d", resp.StatusCode), 502)
		return
	}
	if resp.ContentLength > cityMaxSize {
		http.Error(w, "city dataset exceeds limit", 413)
		return
	}
	raw, e := io.ReadAll(io.LimitReader(resp.Body, cityMaxSize+1))
	if e != nil || len(raw) > cityMaxSize {
		http.Error(w, "world city download failed", 502)
		return
	}
	count, e := validateCitiesGeoJSON(raw)
	if e != nil {
		http.Error(w, "untrusted or incomplete city data: "+e.Error(), 422)
		return
	}
	path, e = cityPath()
	if e != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	if e = os.MkdirAll(filepath.Dir(path), 0700); e != nil {
		http.Error(w, "could not create catalogue directory", 500)
		return
	}
	temp, e := os.CreateTemp(filepath.Dir(path), ".cities-world-*.tmp")
	if e != nil {
		http.Error(w, "could not create temporary file", 500)
		return
	}
	defer os.Remove(temp.Name())
	if _, e = temp.Write(raw); e != nil {
		temp.Close()
		http.Error(w, "could not write city data", 500)
		return
	}
	if e = temp.Sync(); e != nil {
		temp.Close()
		http.Error(w, "could not sync city data", 500)
		return
	}
	if e = temp.Close(); e != nil {
		http.Error(w, "could not close city data", 500)
		return
	}
	if e = os.Rename(temp.Name(), path); e != nil {
		http.Error(w, "could not commit city data", 500)
		return
	}
	sum := sha256.Sum256(raw)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"installed": true, "feature_count": count, "sha256": hex.EncodeToString(sum[:]), "source": "cached"})
}
