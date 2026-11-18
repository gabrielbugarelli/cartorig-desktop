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

// Natural Earth's 1:10m Admin 1 data, redistributed as GeoJSON by datasets/geo-ne-admin1.
// A copy is cached locally after acquisition, so subsequent editing is entirely offline.
// The app never substitutes invented administrative boundaries for missing real data.
const globalAdmin1URL = "https://raw.githubusercontent.com/datasets/geo-ne-admin1/main/data/admin1.geojson"
const admin1MaxSize = 125 << 20

var globalAdminMu sync.Mutex

func globalAdmin1Path() (string, error) {
	dir, err := geoPackDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(dir), "admin1-world.geojson"), nil
}

func admin1Installed() (string, bool) {
	// At build time a validated world dataset can be copied to assets/geodata/admin1_world.geojson.
	// This path makes the resulting installer completely offline from its first launch.
	if f, err := appFiles.Open("assets/geodata/admin1_world.geojson"); err == nil {
		f.Close()
		return "assets/geodata/admin1_world.geojson", true
	}
	file, err := globalAdmin1Path()
	if err != nil {
		return "", false
	}
	proof := cachedDataProof("admin1", file)
	return file, proof.Valid
}

func admin1Source() string {
	// Only developer/test processes may override the source; browser input never supplies a URL.
	if source := os.Getenv("CARTORIG_ADMIN1_SOURCE_URL"); source != "" {
		return source
	}
	return globalAdmin1URL
}

func validateWorldGeoJSON(b []byte) (int, error) {
	var c struct {
		Type     string `json:"type"`
		Features []struct {
			Type       string `json:"type"`
			Properties struct {
				Name  string `json:"name"`
				Admin string `json:"admin"`
			} `json:"properties"`
			Geometry struct {
				Type        string          `json:"type"`
				Coordinates json.RawMessage `json:"coordinates"`
			} `json:"geometry"`
		} `json:"features"`
	}
	if err := json.Unmarshal(b, &c); err != nil {
		return 0, fmt.Errorf("invalid GeoJSON: %w", err)
	}
	if c.Type != "FeatureCollection" || len(c.Features) < 3000 || len(c.Features) > 20000 {
		return 0, fmt.Errorf("expected a global Admin1 FeatureCollection, got %d features", len(c.Features))
	}
	countryCount := make(map[string]bool)
	seen := make(map[string]bool)
	for _, f := range c.Features {
		if f.Type != "Feature" || (f.Geometry.Type != "Polygon" && f.Geometry.Type != "MultiPolygon") || len(f.Geometry.Coordinates) == 0 {
			return 0, errors.New("dataset contains an invalid administrative polygon")
		}
		if f.Properties.Admin != "" {
			countryCount[f.Properties.Admin] = true
		}
		if f.Properties.Admin == "Canada" && (f.Properties.Name == "Ontario" || f.Properties.Name == "Quebec" || f.Properties.Name == "Québec") {
			seen[f.Properties.Name] = true
		}
		if f.Properties.Admin == "United States of America" && f.Properties.Name == "California" {
			seen["California"] = true
		}
	}
	if len(countryCount) < 70 || !seen["Ontario"] || !seen["California"] {
		return 0, errors.New("world Admin1 data is incomplete (missing Canada/USA subdivisions)")
	}
	return len(c.Features), nil
}

func admin1StatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	status := healthForDataset("admin1")
	_ = json.NewEncoder(w).Encode(status)
}

func admin1DataHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	path, installed := admin1Installed()
	if !installed {
		http.Error(w, "world Admin1 dataset not installed", 404)
		return
	}
	w.Header().Set("Content-Type", "application/geo+json")
	w.Header().Set("Cache-Control", "no-store")
	if strings.HasPrefix(path, "assets/") {
		file, err := appFiles.ReadFile(path)
		if err != nil {
			http.Error(w, "bundled dataset missing", 500)
			return
		}
		_, _ = w.Write(file)
		return
	}
	http.ServeFile(w, r, path)
}

func admin1InstallHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", 405)
		return
	}
	globalAdminMu.Lock()
	defer globalAdminMu.Unlock()
	path, already := admin1Installed()
	force := r.URL.Query().Get("repair") == "1"
	if already && force && strings.HasPrefix(path, "assets/") {
		http.Error(w, "bundled world dataset cannot be replaced in place", 409)
		return
	}
	if already && !force {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"installed":true,"already_installed":true}`))
		return
	}
	source := admin1Source()
	if !strings.HasPrefix(source, "https://") && !(os.Getenv("CARTORIG_ADMIN1_SOURCE_URL") != "" && strings.HasPrefix(source, "http://127.0.0.1:")) {
		http.Error(w, "invalid data source", 500)
		return
	}
	client := &http.Client{Timeout: 180 * time.Second}
	resp, err := client.Get(source)
	if err != nil {
		http.Error(w, "could not reach the official Admin1 distribution: "+err.Error(), 503)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		http.Error(w, fmt.Sprintf("Admin1 source returned %d", resp.StatusCode), 502)
		return
	}
	if resp.ContentLength > admin1MaxSize {
		http.Error(w, "world dataset exceeds 125 MB", 413)
		return
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, admin1MaxSize+1))
	if err != nil || len(b) > admin1MaxSize {
		http.Error(w, "world dataset download failed or exceeded size limit", 502)
		return
	}
	n, err := validateWorldGeoJSON(b)
	if err != nil {
		http.Error(w, "untrusted or incomplete geographic data: "+err.Error(), 422)
		return
	}
	path, err = globalAdmin1Path()
	if err != nil {
		http.Error(w, "dataset storage unavailable", 500)
		return
	}
	if err = os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		http.Error(w, "could not create data directory", 500)
		return
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".admin1-world-*.tmp")
	if err != nil {
		http.Error(w, "could not create temporary dataset", 500)
		return
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(b); err != nil {
		f.Close()
		http.Error(w, "could not write dataset", 500)
		return
	}
	if err = f.Sync(); err != nil {
		f.Close()
		http.Error(w, "could not sync dataset", 500)
		return
	}
	if err = f.Close(); err != nil {
		http.Error(w, "could not close dataset", 500)
		return
	}
	if err = os.Rename(f.Name(), path); err != nil {
		http.Error(w, "could not install dataset", 500)
		return
	}
	sha := sha256.Sum256(b)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"installed": true, "feature_count": n, "sha256": hex.EncodeToString(sha[:]), "source": "cached"})
}
