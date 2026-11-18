//go:build !installer

package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"image/png"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Gate every release: 36 native thumbnails must ship offline, contain real PNG
// bitmaps, and be regenerated if a renderer, palette or raster source changed.
func TestBundledSceneLookPreviewsCurrent(t *testing.T) {
	type preview struct {
		Path   string `json:"path"`
		SHA256 string `json:"sha256"`
		Width  int    `json:"width"`
		Height int    `json:"height"`
	}
	var manifest struct {
		SchemaVersion int                `json:"schema_version"`
		Sources       map[string]string  `json:"sources"`
		Previews      map[string]preview `json:"previews"`
	}
	data, err := appFiles.ReadFile("assets/look-previews/manifest.json")
	if err != nil {
		t.Fatal("Missing Scene Looks preview manifest:", err)
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		t.Fatal(err)
	}
	if manifest.SchemaVersion != 1 {
		t.Fatalf("Unexpected preview schema %d", manifest.SchemaVersion)
	}
	keys := []string{"dark", "atlas", "tactical", "relief", "satellite", "night", "elevation", "historical", "terrain"}
    // The audited collection is included as an embedded resource; do not
    // allow an orphan gallery entry or preview to silently disappear.
    auditBytes, err := appFiles.ReadFile("assets/reference-looks.js")
    if err != nil { t.Fatal(err) }
    for _, key := range []string{"noir-monochrome", "oceanic-engraving", "sultan-parchment", "imperial-conquest", "cold-war-archive", "iron-curtain-noir", "heritage-documentary", "copper-topography", "contour-radar", "sepia-expedition", "antique-campaign", "explorer-chart", "turquoise-bathymetry", "compass-antiquity", "desert-caravan", "maritime-manuscript", "alpine-survey", "fantasy-cartographer", "obsidian-minimal", "great-lakes-depth", "vintage-coast-survey", "age-of-sail", "tropical-explorer", "empire-spotlight", "neon-heritage", "engraved-chronicles", "crimson-geopolitics"} {
        if !bytes.Contains(auditBytes, []byte(`"id": "`+key+`"`)) { t.Fatalf("Reference look %s missing from gallery catalog", key) }
        keys = append(keys, key)
    }
	if len(manifest.Previews) != len(keys) {
		t.Fatalf("Wanted 36 previews, got %d", len(manifest.Previews))
	}
	for _, key := range keys {
		p, ok := manifest.Previews[key]
		if !ok || p.Path != "look-previews/"+key+".png" {
			t.Errorf("Missing or mismatched thumbnail %s", key)
			continue
		}
		raw, err := appFiles.ReadFile("assets/" + p.Path)
		if err != nil {
			t.Errorf("Missing embedded image %s: %v", key, err)
			continue
		}
		sha := sha256.Sum256(raw)
		if hex.EncodeToString(sha[:]) != p.SHA256 {
			t.Errorf("Thumbnail hash mismatch %s", key)
		}
		cfg, err := png.DecodeConfig(bytes.NewReader(raw))
		if err != nil {
			t.Errorf("Invalid PNG %s: %v", key, err)
			continue
		}
		if cfg.Width != p.Width || cfg.Height != p.Height || cfg.Width != 288 || cfg.Height != 162 {
			t.Errorf("Unexpected PNG size %s: %dx%d", key, cfg.Width, cfg.Height)
		}
	}
	if len(manifest.Sources) < 8 {
		t.Fatal("Scene Look manifest is missing source fingerprints")
	}
	for name, expected := range manifest.Sources {
		if strings.Contains(name, "..") || strings.HasPrefix(name, "/") || strings.Contains(name, "\\") {
			t.Fatalf("Invalid preview source path %q", name)
		}
		source, err := fs.ReadFile(appFiles, "assets/"+name)
		if err != nil {
			t.Errorf("Preview source missing: %s", name)
			continue
		}
		sha := sha256.Sum256(source)
		if hex.EncodeToString(sha[:]) != expected {
			t.Errorf("Preview source %s changed: regenerate previews before release", name)
		}
	}
}

// The same bytes must be retrievable using the exact URLs used by native img
// elements. This prevents an otherwise valid embedded asset from being served
// under the wrong path or with a redirect to a placeholder.
func TestSceneLooksServedByLocalHTTP(t *testing.T) {
	mux := newMux()
	var m struct { Previews map[string]json.RawMessage `json:"previews"` }
    raw, err := appFiles.ReadFile("assets/look-previews/manifest.json");if err!=nil{t.Fatal(err)}
    if err:=json.Unmarshal(raw,&m);err!=nil{t.Fatal(err)}
    if len(m.Previews)!=36{t.Fatalf("Expected 36 HTTP previews, got %d",len(m.Previews))}
    for name := range m.Previews {
		path := "/assets/look-previews/" + name + ".png"
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("%s: HTTP %d", path, rec.Code)
			continue
		}
		actual := rec.Body.Bytes()
		expected, err := appFiles.ReadFile("assets/look-previews/" + name + ".png")
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(actual, expected) {
			t.Errorf("HTTP image content differs from embedded PNG for %s", name)
		}
		if got := rec.Header().Get("Content-Type"); !strings.HasPrefix(got, "image/png") {
			t.Errorf("%s: wrong content type %q", path, got)
		}
	}
}
