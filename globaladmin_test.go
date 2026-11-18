//go:build !installer

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func syntheticWorldAdmin1() []byte {
	entries := make([]any, 0, 3500)
	add := func(name, admin string, i int) {
		// Synthetic squares are test fixtures only. Never shipped as real boundaries.
		lon := float64(i%120)*2 - 160
		lat := float64((i/120)%40)*2 - 60
		entries = append(entries, map[string]any{"type": "Feature", "properties": map[string]any{"name": name, "name_en": name, "admin": admin, "iso_3166_2": fmt.Sprintf("TEST-%04d", i)}, "geometry": map[string]any{"type": "Polygon", "coordinates": [][][]float64{{{lon, lat}, {lon + 0.5, lat}, {lon + 0.5, lat + 0.5}, {lon, lat + 0.5}, {lon, lat}}}}})
	}
	specials := [][2]string{{"Ontario", "Canada"}, {"Quebec", "Canada"}, {"California", "United States of America"}, {"Bayern", "Germany"}, {"Queensland", "Australia"}, {"Maharashtra", "India"}}
	for i, v := range specials {
		add(v[0], v[1], i)
	}
	for i := len(specials); i < 3500; i++ {
		add(fmt.Sprintf("Unit%04d", i), fmt.Sprintf("Nation%03d", i%160), i)
	}
	payload, _ := json.Marshal(map[string]any{"type": "FeatureCollection", "features": entries})
	return payload
}
func TestWorldAdmin1AcquisitionAndPersistence(t *testing.T) {
 if _,err:=appFiles.Open("assets/geodata/admin1_world.geojson");err==nil {t.Skip("Global Admin1 is already embedded; cache acquisition is tested in partial-source mode")}
	tmp := t.TempDir()
	t.Setenv("CARTORIG_DATA_HOME", tmp)
	data := syntheticWorldAdmin1()
	if len(data) < 100000 {
		t.Fatalf("fixture too small: %d", len(data))
	}
	n, err := validateWorldGeoJSON(data)
	if err != nil || n != 3500 {
		t.Fatalf("valid synthetic global fixture rejected %d: %v", n, err)
	}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(data)
	}))
	defer upstream.Close()
	t.Setenv("CARTORIG_ADMIN1_SOURCE_URL", upstream.URL)
	mux := newMux()
	status := httptest.NewRecorder()
	mux.ServeHTTP(status, httptest.NewRequest("GET", "/api/admin1/status", nil))
	if !strings.Contains(status.Body.String(), `"installed":false`) {
		t.Fatal(status.Body.String())
	}
	post := httptest.NewRecorder()
	mux.ServeHTTP(post, httptest.NewRequest("POST", "/api/admin1/install", nil))
	if post.Code != 200 {
		t.Fatalf("install returned %d: %s", post.Code, post.Body.String())
	}
	status = httptest.NewRecorder()
	mux.ServeHTTP(status, httptest.NewRequest("GET", "/api/admin1/status", nil))
	if !strings.Contains(status.Body.String(), `"installed":true`) {
		t.Fatal(status.Body.String())
	}
	get := httptest.NewRecorder()
	mux.ServeHTTP(get, httptest.NewRequest("GET", "/api/admin1/data", nil))
	if get.Code != 200 || !bytes.Equal(get.Body.Bytes(), data) {
		t.Fatalf("cached GeoJSON differs (%d)", get.Code)
	}
	path, _ := globalAdmin1Path()
	if _, err = os.Stat(path); err != nil {
		t.Fatal(err)
	}
	post = httptest.NewRecorder()
	mux.ServeHTTP(post, httptest.NewRequest("POST", "/api/admin1/install", nil))
	if !strings.Contains(post.Body.String(), `"already_installed":true`) {
		t.Fatal("second install did not use cache")
	}
}
func TestWorldAdmin1RejectsIncomplete(t *testing.T) {
	b := []byte(`{"type":"FeatureCollection","features":[]}`)
	if _, err := validateWorldGeoJSON(b); err == nil {
		t.Fatal("accepted fake empty world data")
	}
}
func TestWorldAdmin1Auth(t *testing.T) {
	mux := secureLocal(newMux())
	req := httptest.NewRequest("POST", "http://127.0.0.1:9876/api/admin1/install", nil)
	req.Host = "127.0.0.1:9876"
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != 403 {
		t.Fatalf("unauthenticated install was accepted: %d", w.Code)
	}
	req = httptest.NewRequest("GET", "http://127.0.0.1:9876/api/admin1/status", nil)
	req.Host = "127.0.0.1:9876"
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	body, _ := io.ReadAll(w.Body)
	if w.Code != 200 || !bytes.Contains(body, []byte(`"installed"`)) {
		t.Fatalf("status unavailable %d", w.Code)
	}
}
