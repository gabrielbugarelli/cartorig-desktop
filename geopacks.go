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
	"regexp"
	"sort"
	"strings"
)

const maxGeoPackSize int64 = 120 << 20

var safeGeoID = regexp.MustCompile(`^[0-9a-f]{64}$`)
var allowedGeoTypes = map[string]bool{"Auto": true, "Country": true, "State": true, "City": true, "River": true, "Lake": true, "Coastline": true}

type storedGeoPack struct {
	ID       string          `json:"id"`
	Filename string          `json:"filename"`
	Kind     string          `json:"kind"`
	Data     json.RawMessage `json:"data"`
}

type geoPackSummary struct {
	ID       string `json:"id"`
	Filename string `json:"filename"`
	Kind     string `json:"kind"`
}

func geoPackDir() (string, error) {
	if custom := os.Getenv("CARTORIG_DATA_HOME"); custom != "" {
		return filepath.Join(custom, "geopacks"), nil
	}
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		var err error
		base, err = os.UserConfigDir()
		if err != nil {
			return "", err
		}
	}
	return filepath.Join(base, "CartoRig", "geopacks"), nil
}

func validGeoPack(pack storedGeoPack) error {
	if !allowedGeoTypes[pack.Kind] {
		return errors.New("unsupported geographical type")
	}
	if len(pack.Filename) < 1 || len(pack.Filename) > 160 || filepath.Base(pack.Filename) != pack.Filename || strings.ContainsAny(pack.Filename, "/\\\x00") {
		return errors.New("invalid dataset name")
	}
	if len(pack.Data) < 10 || int64(len(pack.Data)) > maxGeoPackSize {
		return errors.New("dataset size invalid")
	}
	var manifest struct {
		Type     string            `json:"type"`
		Features []json.RawMessage `json:"features"`
	}
	if err := json.Unmarshal(pack.Data, &manifest); err != nil {
		return errors.New("invalid GeoJSON: " + err.Error())
	}
	if manifest.Type != "FeatureCollection" || len(manifest.Features) == 0 || len(manifest.Features) > 20000 {
		return errors.New("GeoJSON requires 1-20000 features")
	}
	// Each feature must be actual GeoJSON with a geometry of the expected general type.
	sample := len(manifest.Features)
	if sample > 16 {
		sample = 16
	}
	for i := 0; i < sample; i++ {
		var f struct {
			Type     string `json:"type"`
			Geometry struct {
				Type        string          `json:"type"`
				Coordinates json.RawMessage `json:"coordinates"`
			} `json:"geometry"`
		}
		if json.Unmarshal(manifest.Features[i], &f) != nil || f.Type != "Feature" || f.Geometry.Type == "" || !json.Valid(f.Geometry.Coordinates) {
			return errors.New("dataset contains invalid features")
		}
	}
	return nil
}

func geoPacksHandler(w http.ResponseWriter, r *http.Request) {
	dir, err := geoPackDir()
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	switch r.Method {
	case http.MethodPost:
		r.Body = http.MaxBytesReader(w, r.Body, maxGeoPackSize+(2<<20))
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "dataset too large", 413)
			return
		}
		var p storedGeoPack
		if json.Unmarshal(body, &p) != nil {
			http.Error(w, "invalid dataset envelope", 400)
			return
		}
		if err = validGeoPack(p); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		hash := sha256.Sum256([]byte(p.Filename + "\n" + p.Kind + "\n" + string(p.Data)))
		p.ID = hex.EncodeToString(hash[:])
		if err = os.MkdirAll(dir, 0700); err != nil {
			http.Error(w, "could not create dataset folder", 500)
			return
		}
		final := filepath.Join(dir, p.ID+".json")
		if _, err = os.Stat(final); err != nil {
			saved, _ := json.Marshal(p)
			f, e := os.CreateTemp(dir, ".geopack-*")
			if e != nil {
				http.Error(w, "could not stage dataset", 500)
				return
			}
			tmp := f.Name()
			defer os.Remove(tmp)
			if _, e = f.Write(saved); e != nil {
				f.Close()
				http.Error(w, "could not write dataset", 500)
				return
			}
			if e = f.Sync(); e != nil {
				f.Close()
				http.Error(w, "could not sync dataset", 500)
				return
			}
			if e = f.Close(); e != nil {
				http.Error(w, "could not close dataset", 500)
				return
			}
			if e = os.Rename(tmp, final); e != nil {
				http.Error(w, "could not install dataset", 500)
				return
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(geoPackSummary{ID: p.ID, Filename: p.Filename, Kind: p.Kind})
	case http.MethodGet:
		files, err := os.ReadDir(dir)
		list := []geoPackSummary{}
		if err != nil && !os.IsNotExist(err) {
			http.Error(w, "could not list datasets", 500)
			return
		}
		for _, f := range files {
			if f.IsDir() || !strings.HasSuffix(f.Name(), ".json") || !safeGeoID.MatchString(strings.TrimSuffix(f.Name(), ".json")) {
				continue
			}
			path := filepath.Join(dir, f.Name())
			b, e := os.ReadFile(path)
			if e != nil {
				continue
			}
			var p storedGeoPack
			if json.Unmarshal(b, &p) == nil && p.ID+".json" == f.Name() && allowedGeoTypes[p.Kind] {
				list = append(list, geoPackSummary{ID: p.ID, Filename: p.Filename, Kind: p.Kind})
			}
		}
		sort.Slice(list, func(i, j int) bool { return list[i].Filename < list[j].Filename })
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(list)
	default:
		http.Error(w, "Method not allowed", 405)
	}
}

func geoPackGetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", 405)
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/geo-packs/")
	if !safeGeoID.MatchString(id) {
		http.Error(w, "Invalid pack ID", 400)
		return
	}
	dir, err := geoPackDir()
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	b, err := os.ReadFile(filepath.Join(dir, id+".json"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	var p storedGeoPack
	if json.Unmarshal(b, &p) != nil || p.ID != id {
		http.Error(w, "dataset corrupted", 500)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprint(w, string(b))
}
