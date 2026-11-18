//go:build !installer

package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestLocalStyleLibraryAtomicRoundtrip(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Setenv("APPDATA", t.TempDir())
	} else {
		t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	}
	sample := []byte(`[{"format":"cartorig-style","schema_version":"1.0.0","id":"55e77661-1d58-4896-b5dd-a52d545405f1","name":"Historical","palette":{"land":"#ddbbaa","ocean":"#112233"},"defaults":{"Region":{"fill_color":"#bb3344"}}}]`)
	if err := validateStyleLibrary(sample); err != nil {
		t.Fatal(err)
	}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/styles", bytes.NewReader(sample))
	stylesLibraryHandler(rr, req)
	if rr.Code != 200 {
		t.Fatalf("post %d: %s", rr.Code, rr.Body.String())
	}
	path, err := styleLibraryPath()
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(path) != "style-library.json" {
		t.Fatal(path)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
	rr = httptest.NewRecorder()
	stylesLibraryHandler(rr, httptest.NewRequest(http.MethodGet, "/api/styles", nil))
	if rr.Code != 200 {
		t.Fatal(rr.Code, rr.Body.String())
	}
	var got []localStyle
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got[0].Name != "Historical" {
		t.Fatal(got)
	}
	for _, invalid := range [][]byte{[]byte(`{}`), []byte(`[{"format":"x"}]`), []byte(`[{"format":"cartorig-style","schema_version":"1.0.0","id":"55e77661-1d58-4896-b5dd-a52d545405f1","name":"X","palette":{"texture":"https://external.example"}}]`)} {
		if err := validateStyleLibrary(invalid); err == nil {
			t.Fatal("bad style accepted", string(invalid))
		}
		rr = httptest.NewRecorder()
		stylesLibraryHandler(rr, httptest.NewRequest(http.MethodPost, "/api/styles", bytes.NewReader(invalid)))
		if rr.Code != 400 {
			t.Fatalf("expected 400, got %d", rr.Code)
		}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(sample, data) {
		t.Fatal("bad import corrupted the last saved library")
	}
}

func TestStyleAssetMetadataRejectUnsafePaths(t *testing.T) {
	valid := []byte(`[{"format":"cartorig-style","schema_version":"1.0.0","id":"55e77661-1d58-4896-b5dd-a52d545405f1","name":"Test","palette":{"land":"#abcdef"},"defaults":{},"metadata":{"origin":"CartoRig","source_version":"1.4.2"},"asset_refs":[{"asset_id":"45e77661-1d58-4896-b5dd-a52d545405f1","relative_path":"assets/icon_01.svg","sha256":"` + strings.Repeat("a", 64) + `","mime_type":"image/svg+xml"}]}]`)
	if err := validateStyleLibrary(valid); err != nil {
		t.Fatalf("valid style rejected: %v", err)
	}
	for _, unsafe := range []string{"../icon.svg", "https://example.com/file.svg", "assets/../../bad.png"} {
		bad := bytes.Replace(valid, []byte("assets/icon_01.svg"), []byte(unsafe), 1)
		if err := validateStyleLibrary(bad); err == nil {
			t.Fatalf("unsafe asset path accepted: %q", unsafe)
		}
	}
}
