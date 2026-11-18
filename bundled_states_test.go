//go:build !installer

package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBundledBrazilianStateGeometriesAccessible(t *testing.T) {
	for _, path := range []string{"assets/geodata/br_states.geojson"} {
		content, err := appFiles.ReadFile(path)
		if err != nil {
			t.Fatalf("bundled geographic resource %s missing: %v", path, err)
		}
		if len(content) < 10000 {
			t.Fatalf("bundled geographic resource %s truncated", path)
		}
		if path == "assets/geodata/br_states.geojson" && (!bytes.Contains(content, []byte(`"type":"FeatureCollection"`)) || !bytes.Contains(content, []byte(`"sigla":"MT"`))) {
			t.Fatal("Bundled GeoJSON has no state polygons")
		}
	}
	r := httptest.NewRequest(http.MethodGet, "/assets/geodata/br_states.geojson", nil)
	r.Host = "127.0.0.1:13000"
	w := httptest.NewRecorder()
	secureLocal(newMux()).ServeHTTP(w, r)
	if w.Code != 200 || w.Body.Len() < 10000 {
		t.Fatalf("Offline state GeoJSON not exposed by app: %d %d bytes", w.Code, w.Body.Len())
	}
}
