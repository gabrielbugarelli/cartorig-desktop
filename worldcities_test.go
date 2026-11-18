//go:build !installer

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func citiesFixture(n int) []byte {
	features := make([]any, 0, n)
	for i := 0; i < n; i++ {
		name := fmt.Sprintf("Test City %04d", i)
		if i == 0 {
			name = "Munich"
		}
		features = append(features, map[string]any{"type": "Feature", "properties": map[string]any{"name": name, "adm0name": fmt.Sprintf("Test Nation %d", i%120)}, "geometry": map[string]any{"type": "Point", "coordinates": []float64{float64((i % 120) - 60), float64((i % 90) - 45)}}})
	}
	b, _ := json.Marshal(map[string]any{"type": "FeatureCollection", "features": features})
	return b
}
func TestCitiesBuiltInRealPoints(t *testing.T) {
	b, e := appFiles.ReadFile("assets/geodata/cities_world.geojson")
	if e != nil {
		t.Fatal(e)
	}
	var data struct {
		Type     string `json:"type"`
		Features []struct {
			Properties struct {
				Name  string `json:"name"`
				Admin string `json:"adm0name"`
			} `json:"properties"`
			Geometry struct {
				Type        string    `json:"type"`
				Coordinates []float64 `json:"coordinates"`
			} `json:"geometry"`
		} `json:"features"`
	}
	if e = json.Unmarshal(b, &data); e != nil {
		t.Fatal(e)
	}
	if data.Type != "FeatureCollection" || len(data.Features) != 244 {
		t.Fatalf("expected 244 bundled city locations got %d", len(data.Features))
	}
	found := false
	for _, f := range data.Features {
		if f.Properties.Name == "Munich" && f.Properties.Admin == "Germany" && f.Geometry.Type == "Point" && f.Geometry.Coordinates[0] > 11 && f.Geometry.Coordinates[0] < 12 && f.Geometry.Coordinates[1] > 48 && f.Geometry.Coordinates[1] < 49 {
			found = true
		}
	}
	if !found {
		t.Fatal("Munich point not bundled")
	}
}
func TestCityDownloadValidateCacheAndRejectCorruption(t *testing.T) {
 if _,err:=appFiles.Open("assets/geodata/cities_world_full.geojson");err==nil {t.Skip("Worldwide cities already embedded; download/cache path tested without fullgeo source")}
	dir := t.TempDir()
	t.Setenv("CARTORIG_DATA_HOME", dir)
	valid := citiesFixture(1200)
	if n, e := validateCitiesGeoJSON(valid); e != nil || n != 1200 {
		t.Fatalf("valid fixture %d %v", n, e)
	}
	broken := bytes.Replace(valid, []byte(`"Munich"`), []byte(`"MissingCity"`), 1)
	if _, e := validateCitiesGeoJSON(broken); e == nil {
		t.Fatal("accepted fixture without Munich")
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(valid)
	}))
	defer server.Close()
	t.Setenv("CARTORIG_CITIES_SOURCE_URL", server.URL)
	req := httptest.NewRequest(http.MethodPost, "/api/cities/install", nil)
	recorder := httptest.NewRecorder()
	cityInstallHandler(recorder, req)
	if recorder.Code != 200 {
		t.Fatalf("install %d %s", recorder.Code, recorder.Body.String())
	}
	path, _ := cityPath()
	saved, e := os.ReadFile(path)
	if e != nil || !bytes.Equal(saved, valid) {
		t.Fatal("city cache corrupted or missing", e)
	}
	status := httptest.NewRecorder()
	cityStatusHandler(status, httptest.NewRequest(http.MethodGet, "/api/cities/status", nil))
	if status.Code != 200 || !bytes.Contains(status.Body.Bytes(), []byte(`"installed":true`)) {
		t.Fatal("city status incorrect", status.Body.String())
	}
	data := httptest.NewRecorder()
	cityDataHandler(data, httptest.NewRequest(http.MethodGet, "/api/cities/data", nil))
	if data.Code != 200 || !bytes.Equal(data.Body.Bytes(), valid) {
		t.Fatal("cached data mismatch")
	}
	if filepath.Base(path) != "cities-world.geojson" {
		t.Fatal("unexpected cache location")
	}
}
