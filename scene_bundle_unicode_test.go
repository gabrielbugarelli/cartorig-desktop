//go:build !installer

package main

import (
	"archive/zip"
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Regression: user scenes containing "Bolívar" must export Classic layers ZIP.
func TestClassicLayerUnicodeNames(t *testing.T) {
	for _, layer := range []string{
		"004_Region_Bolívar.png",
		"001_Region_São_Paulo.png",
		"002_Region_Αθήνα.png",
		"003_Region_東京.png",
	} {
		if !validLayerName.MatchString(layer) {
			t.Fatalf("valid layer rejected: %q", layer)
		}
		var body bytes.Buffer
		mw := multipart.NewWriter(&body)
		_ = mw.WriteField("project", `{"format":"cartorig-project","name":"Untitled Map"}`)
		_ = mw.WriteField("manifest", `{"layers":[]}`)
		for _, f := range []struct{ field, name string }{{"layer", layer}, {"final", "Final_Composite.png"}} {
			part, err := mw.CreateFormFile(f.field, f.name)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := part.Write(tinyPNG(t)); err != nil {
				t.Fatal(err)
			}
		}
		if err := mw.Close(); err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest(http.MethodPost, "/api/scene-bundle", &body)
		req.Header.Set("Content-Type", mw.FormDataContentType())
		req.Header.Set("X-CartoRig-Token", sessionToken)
		req.Host = "127.0.0.1:8900"
		rr := httptest.NewRecorder()
		secureLocal(newMux()).ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("layer %q: HTTP %d %s", layer, rr.Code, rr.Body.String())
		}
		zr, err := zip.NewReader(bytes.NewReader(rr.Body.Bytes()), int64(rr.Body.Len()))
		if err != nil {
			t.Fatal(err)
		}
		found := false
		for _, file := range zr.File {
			if file.Name == "CartoRig/layers/"+layer {
				found = true
				r, err := file.Open()
				if err != nil {
					t.Fatal(err)
				}
				data, err := io.ReadAll(r)
				_ = r.Close()
				if err != nil || !bytes.Equal(data, tinyPNG(t)) {
					t.Fatalf("layer %q corrupted", layer)
				}
			}
		}
		if !found {
			t.Fatalf("layer %q omitted from ZIP", layer)
		}
	}
}

func TestClassicLayerRejectUnsafeNames(t *testing.T) {
	for _, name := range []string{
		"../evil.png", "folder/bad.png", `folder\\bad.png`, "dangerous.png.exe",
		"bad name.png", "bad\nname.png", "with:colon.png", "bad?.png", "🙃.png", "bad.svg", "",
	} {
		if validLayerName.MatchString(name) {
			t.Errorf("unsafe layer accepted: %q", name)
		}
	}
	// A filename is a single path component, never an absolute path.
	for _, s := range []string{"/tmp/allowed.png", "../allowed.png", "C:\\allowed.png"} {
		if strings.ContainsAny(s, `/\\`) && validLayerName.MatchString(s) {
			t.Errorf("accepted directory traversal: %q", s)
		}
	}
}
