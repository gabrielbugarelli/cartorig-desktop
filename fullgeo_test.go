//go:build fullgeo && !installer

package main

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRealWorldBundledSourcesPresentAndFingerprinted(t *testing.T) {
	if !offlineReleaseVerified {
		t.Fatal("release not verified")
	}
	for _, name := range []string{"admin1", "cities"} {
		info := healthForDataset(name)
		if !info.Installed || info.Source != "bundled" || !info.DistributionComplete || info.Integrity != "verified" || len(info.SHA256) != 64 {
			t.Fatalf("%s not complete %+v", name, info)
		}
		record := offlineReleaseRecords[name]
		if name == "admin1" && record.FeatureCount != 4596 {
			t.Fatalf("real admin1 expected 4596, got %d", record.FeatureCount)
		}
		if name == "cities" && record.FeatureCount != 7342 {
			t.Fatalf("real cities expected 7342, got %d", record.FeatureCount)
		}
	}
	r := httptest.NewRequest("GET", "http://127.0.0.1:8080/api/geodata/verify", nil)
	response := httptest.NewRecorder()
	secureLocal(newMux()).ServeHTTP(response, r)
	if response.Code != 200 {
		t.Fatalf("geodata verification endpoint %d: %s", response.Code, response.Body.String())
	}
	var data struct {
		GlobalOfflineReady bool `json:"global_offline_ready"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &data); err != nil || !data.GlobalOfflineReady {
		t.Fatalf("fullgeo must be guaranteed offline: %v %s", err, response.Body.String())
	}
	if strings.Contains(response.Body.String(), `"integrity":"invalid"`) {
		t.Fatal("invalid bundled source")
	}
}
