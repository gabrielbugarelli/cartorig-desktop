//go:build !installer

package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"image/png"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Bundled Scene Looks 2.0 must contain real local materials with pinned
// fingerprints, not missing files or assets downloaded at runtime.
func TestSceneLookMaterialsEmbeddedAndServed(t *testing.T) {
	var manifest struct {
		Schema    int `json:"schema_version"`
		Materials map[string]struct {
			Hash  string `json:"sha256"`
			Bytes int    `json:"bytes"`
		} `json:"materials"`
	}
	raw, err := appFiles.ReadFile("assets/look-materials/manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(raw, &manifest); err != nil {
		t.Fatal(err)
	}
	if manifest.Schema != 1 || len(manifest.Materials) != 21 {
		t.Fatalf("Expected 21 licensed local materials, got %d", len(manifest.Materials))
	}
	mux := newMux()
	for name, record := range manifest.Materials {
		path := "assets/look-materials/" + name + ".png"
		data, err := appFiles.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if len(data) != record.Bytes {
			t.Fatalf("%s size changed", name)
		}
		digest := sha256.Sum256(data)
		if hex.EncodeToString(digest[:]) != record.Hash {
			t.Fatalf("%s digest changed", name)
		}
		cfg, err := png.DecodeConfig(bytes.NewReader(data))
		if err != nil {
			t.Fatal(err)
		}
		if cfg.Width != 256 || cfg.Height != 256 {
			t.Errorf("%s invalid tile dimensions", name)
		}
		request := httptest.NewRequest(http.MethodGet, "/"+path, nil)
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, request)
		if response.Code != http.StatusOK || !bytes.Equal(response.Body.Bytes(), data) {
			t.Fatalf("Material %s is not correctly served offline", name)
		}
	}
}
