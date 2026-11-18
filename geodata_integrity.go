//go:build !installer

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Included in a fullgeo binary; otherwise the optional cache can be validated.
type geographyReleaseRecord struct {
	DatasetID        string `json:"dataset_id"`
	Scale            string `json:"scale"`
	SourceURL        string `json:"source_url"`
	SourceRepository string `json:"source_repository"`
	SHA256           string `json:"sha256"`
	GitBlobSHA       string `json:"git_blob_sha1"`
	FeatureCount     int    `json:"feature_count"`
	CountryCount     int    `json:"country_count"`
	Bytes            int    `json:"bytes"`
	SourceVersion    string `json:"source_path"`
}

var offlineReleaseRecords = make(map[string]geographyReleaseRecord)
var offlineReleaseVerified bool

type cachedFileProof struct {
	Size  int64
	Mtime int64
	Count int
	SHA   string
	Valid bool
	Error string
}

var cacheProofs = struct {
	sync.Mutex
	Entries map[string]cachedFileProof
}{Entries: make(map[string]cachedFileProof)}

func validateAndHash(kind string, data []byte) (int, string, error) {
	var n int
	var err error
	if kind == "admin1" {
		n, err = validateWorldGeoJSON(data)
	} else {
		n, err = validateCitiesGeoJSON(data)
	}
	if err != nil {
		return 0, "", err
	}
	sum := sha256.Sum256(data)
	return n, hex.EncodeToString(sum[:]), nil
}
func cachedDataProof(kind, path string) cachedFileProof {
	stat, e := os.Stat(path)
	if e != nil || stat.IsDir() {
		return cachedFileProof{Error: "not installed"}
	}
	key := kind + ":" + path
	cacheProofs.Lock()
	defer cacheProofs.Unlock()
	if saved, ok := cacheProofs.Entries[key]; ok && saved.Size == stat.Size() && saved.Mtime == stat.ModTime().UnixNano() {
		return saved
	}
	data, e := os.ReadFile(path)
	proof := cachedFileProof{Size: stat.Size(), Mtime: stat.ModTime().UnixNano()}
	if e == nil {
		proof.Count, proof.SHA, e = validateAndHash(kind, data)
	}
	proof.Valid = e == nil
	if e != nil {
		proof.Error = e.Error()
	}
	cacheProofs.Entries[key] = proof
	return proof
}
func bundledFilePath(kind string) string {
	if kind == "admin1" {
		return "assets/geodata/admin1_world.geojson"
	}
	return "assets/geodata/cities_world_full.geojson"
}
func localDataFile(kind string) (string, error) {
	if kind == "admin1" {
		return globalAdmin1Path()
	}
	return cityPath()
}

type dataHealth struct {
	DatasetID            string `json:"dataset_id"`
	Name                 string `json:"dataset"`
	Installed            bool   `json:"installed"`
	Source               string `json:"source"`
	Scale                string `json:"scale"`
	SourceURL            string `json:"source_url"`
	Version              string `json:"source_version"`
	FeatureCount         int    `json:"feature_count"`
	CountryCount         int    `json:"country_count,omitempty"`
	SHA256               string `json:"sha256,omitempty"`
	Integrity            string `json:"integrity"`
	Error                string `json:"error,omitempty"`
	BundledFallbackCount int    `json:"bundled_fallback_count,omitempty"`
	DistributionComplete bool   `json:"distribution_complete"`
}

func healthForDataset(kind string) dataHealth {
	x := dataHealth{DatasetID: "ne_10m_admin1_world", Name: "Natural Earth Admin 1 — states/provinces", Source: "none", Scale: "10m", Integrity: "missing", SourceURL: globalAdmin1URL}
	if kind == "cities" {
		x.DatasetID = "ne_10m_populated_places_world"
		x.Name = "Natural Earth Populated Places — cities"
		x.SourceURL = globalCitiesURL
		x.BundledFallbackCount = 244
	}
	if _, e := appFiles.Open(bundledFilePath(kind)); e == nil {
		x.Source = "bundled"
		if record, ok := offlineReleaseRecords[kind]; ok && offlineReleaseVerified {
			x.Installed = true
			x.DistributionComplete = true
			x.Integrity = "verified"
			x.SHA256 = record.SHA256
			x.FeatureCount = record.FeatureCount
			x.CountryCount = record.CountryCount
			x.SourceURL = record.SourceURL
			x.Version = record.GitBlobSHA
		} else {
			data, e := appFiles.ReadFile(bundledFilePath(kind))
			if e != nil {
				x.Integrity = "invalid"
				x.Error = e.Error()
			} else {
				x.FeatureCount, x.SHA256, e = validateAndHash(kind, data)
				x.Installed = e == nil
				if e != nil {
					x.Integrity = "invalid"
					x.Error = e.Error()
				} else {
					x.Integrity = "content_valid_unpinned"
					x.DistributionComplete = true
				}
			}
		}
		return x
	}
	path, e := localDataFile(kind)
	if e != nil {
		x.Integrity = "unavailable"
		x.Error = e.Error()
		return x
	}
	_, e = os.Stat(path)
	if os.IsNotExist(e) {
		return x
	}
	x.Source = "cached"
	proof := cachedDataProof(kind, path)
	x.Installed = proof.Valid
	x.FeatureCount = proof.Count
	x.SHA256 = proof.SHA
	if proof.Valid {
		x.Integrity = "content_valid_unpinned"
	} else {
		x.Integrity = "invalid"
		x.Error = proof.Error
	}
	return x
}
func geodataIntegrityHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	a, c := healthForDataset("admin1"), healthForDataset("cities")
	datasets := []dataHealth{a, c}
	allVerified := a.Installed && c.Installed && a.DistributionComplete && c.DistributionComplete && a.Integrity == "verified" && c.Integrity == "verified"
	_ = json.NewEncoder(w).Encode(map[string]any{
		"product_version": version, "global_offline_ready": allVerified,
		"datasets":        datasets,
		"coverage_policy": "All features delivered by the locked Natural Earth 10m sources; no synthetic features.",
	})
}
func manifestRecord(kind string, manifest []byte) (geographyReleaseRecord, error) {
	var m struct {
		Schema   string                            `json:"schema"`
		Version  string                            `json:"app_version"`
		Datasets map[string]geographyReleaseRecord `json:"datasets"`
	}
	if e := json.Unmarshal(manifest, &m); e != nil {
		return geographyReleaseRecord{}, e
	}
	if m.Schema != "cartorig-offline-integrity-v1" || m.Version != "1.2.3" {
		return geographyReleaseRecord{}, fmt.Errorf("offline manifest schema or version mismatch")
	}
	record, ok := m.Datasets[kind]
	if !ok || len(record.SHA256) != 64 || record.FeatureCount < 3000 {
		return geographyReleaseRecord{}, fmt.Errorf("missing or incomplete manifest %s", kind)
	}
	if kind == "admin1" && !strings.Contains(record.DatasetID, "admin1") {
		return geographyReleaseRecord{}, fmt.Errorf("Admin1 dataset identity mismatch")
	}
	if kind == "cities" && !strings.Contains(record.DatasetID, "populated") {
		return geographyReleaseRecord{}, fmt.Errorf("city dataset identity mismatch")
	}
	if filepath.Ext(record.SourceVersion) != ".geojson" {
		return geographyReleaseRecord{}, fmt.Errorf("dataset source filename not verified")
	}
	return record, nil
}
