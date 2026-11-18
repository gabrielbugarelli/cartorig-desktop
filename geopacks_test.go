//go:build !installer

package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestGeoPackPersistentAcrossRequests(t *testing.T) {
	t.Setenv("CARTORIG_DATA_HOME", t.TempDir())
	mux := secureLocal(newMux())
	data := `{"filename":"admin1_sample.geojson","kind":"State","data":{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Sample"},"geometry":{"type":"Polygon","coordinates":[[[1,1],[2,1],[2,2],[1,1]]]}}]}}`
	post := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:12345/api/geo-packs", bytes.NewBufferString(data))
	post.Header.Set("X-CartoRig-Token", sessionToken)
	post.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, post)
	if w.Code != 200 {
		t.Fatalf("upload %d %s", w.Code, w.Body.String())
	}
	var summary geoPackSummary
	if err := json.Unmarshal(w.Body.Bytes(), &summary); err != nil || len(summary.ID) != 64 {
		t.Fatal("invalid installed ID", err)
	}
	dir, _ := geoPackDir()
	if _, err := os.Stat(filepath.Join(dir, summary.ID+".json")); err != nil {
		t.Fatal("missing persisted data", err)
	}
	list := httptest.NewRecorder()
	mux.ServeHTTP(list, httptest.NewRequest(http.MethodGet, "http://127.0.0.1:12345/api/geo-packs", nil))
	if list.Code != 200 || !bytes.Contains(list.Body.Bytes(), []byte("admin1_sample")) {
		t.Fatal(list.Code, list.Body.String())
	}
	get := httptest.NewRecorder()
	mux.ServeHTTP(get, httptest.NewRequest(http.MethodGet, "http://127.0.0.1:12345/api/geo-packs/"+summary.ID, nil))
	if get.Code != 200 || !bytes.Contains(get.Body.Bytes(), []byte("Sample")) {
		t.Fatal(get.Code, get.Body.String())
	}
}
func TestGeoPackRejectsUnauthorizedOrInvalid(t *testing.T) {
	t.Setenv("CARTORIG_DATA_HOME", t.TempDir())
	mux := secureLocal(newMux())
	request := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:12345/api/geo-packs", bytes.NewBufferString(`{"filename":"../../sneaky.json","kind":"State","data":{"type":"FeatureCollection","features":[]}}`))
	blocked := httptest.NewRecorder()
	mux.ServeHTTP(blocked, request)
	if blocked.Code != 403 {
		t.Fatal("missing token should block", blocked.Code)
	}
	request.Header.Set("X-CartoRig-Token", sessionToken)
	malformed := httptest.NewRecorder()
	mux.ServeHTTP(malformed, request)
	if malformed.Code != 400 {
		t.Fatal("invalid dataset should block", malformed.Code)
	}
	traversal := httptest.NewRecorder()
	mux.ServeHTTP(traversal, httptest.NewRequest(http.MethodGet, "http://127.0.0.1:12345/api/geo-packs/abcdef", nil))
	if traversal.Code != 400 {
		t.Fatal("invalid dataset ID", traversal.Code)
	}
}
