package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOfflineMapLabelsEmbeddedAndServed(t *testing.T) {
	raw, err := appFiles.ReadFile("assets/geodata/map_labels.json")
	if err != nil {
		t.Fatalf("offline map label catalog missing from executable: %v", err)
	}
	var catalog struct {
		Version          int               `json:"version"`
		Countries        []json.RawMessage `json:"countries"`
		States           []json.RawMessage `json:"states"`
		NationalCapitals []json.RawMessage `json:"national_capitals"`
		RegionalCapitals []json.RawMessage `json:"regional_capitals"`
		Cities           []json.RawMessage `json:"cities"`
		Oceans           []json.RawMessage `json:"oceans"`
		Seas             []json.RawMessage `json:"seas"`
	}
	if err := json.Unmarshal(raw, &catalog); err != nil {
		t.Fatal(err)
	}
	if catalog.Version != 1 || len(catalog.Countries) != 177 || len(catalog.States) < 4500 || len(catalog.NationalCapitals) < 190 || len(catalog.RegionalCapitals) < 2200 || len(catalog.Cities) < 4500 || len(catalog.Oceans) < 5 || len(catalog.Seas) < 30 {
		t.Fatalf("offline map labels invalid/incomplete: %+v", catalog)
	}
	r := httptest.NewRecorder()
	newMux().ServeHTTP(r, httptest.NewRequest(http.MethodGet, "/assets/geodata/map_labels.json", nil))
	if r.Code != http.StatusOK {
		t.Fatalf("offline map labels URL failed: HTTP %d", r.Code)
	}
	if len(r.Body.Bytes()) != len(raw) {
		t.Fatalf("served map label catalog truncated: %d vs %d", len(r.Body.Bytes()), len(raw))
	}
}
