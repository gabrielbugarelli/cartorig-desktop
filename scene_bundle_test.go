//go:build !installer

package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func tinyPNG(t *testing.T) []byte {
	t.Helper()
	im := image.NewNRGBA(image.Rect(0, 0, 2, 2))
	im.Set(1, 1, color.NRGBA{255, 20, 30, 255})
	var b bytes.Buffer
	if err := png.Encode(&b, im); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}
func TestSceneBundleZip(t *testing.T) {
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	_ = mw.WriteField("project", `{"format":"cartorig-project","scene":{}}`)
	_ = mw.WriteField("manifest", `{"layers":[{"file":"001_Region_Brazil.png"}]}`)
	for _, name := range []string{"001_Region_Brazil.png", "Final_Composite.png"} {
		key := "layer"
		if name == "Final_Composite.png" {
			key = "final"
		}
		f, _ := mw.CreateFormFile(key, name)
		_, _ = f.Write(tinyPNG(t))
	}
	_ = mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/scene-bundle", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Host = "127.0.0.1:8888"
	req.Header.Set("X-CartoRig-Token", sessionToken)
	rr := httptest.NewRecorder()
	secureLocal(newMux()).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("%d: %s", rr.Code, rr.Body.String())
	}
	z, err := zip.NewReader(bytes.NewReader(rr.Body.Bytes()), int64(rr.Body.Len()))
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, f := range z.File {
		got[f.Name] = true
		r, e := f.Open()
		if e != nil {
			t.Fatal(e)
		}
		_, _ = io.Copy(io.Discard, r)
		r.Close()
	}
	for _, name := range []string{"CartoRig/manifest.json", "CartoRig/project.cartorig", "CartoRig/layers/001_Region_Brazil.png", "CartoRig/Final_Composite.png"} {
		if !got[name] {
			t.Fatal("missing", name)
		}
	}
}
func TestLocalSecurity(t *testing.T) {
	for _, tc := range []struct {
		host, token, origin string
		expected            int
	}{{"127.0.0.1:8081", "", "", 403}, {"untrusted.example:8081", sessionToken, "", 403}, {"127.0.0.1:8081", sessionToken, "http://attacker.example", 403}, {"127.0.0.1:8081", sessionToken, "http://127.0.0.1:8081", 200}} {
		req := httptest.NewRequest(http.MethodPost, "/api/bundle", strings.NewReader(""))
		req.Host = tc.host
		req.Header.Set("X-CartoRig-Token", tc.token)
		if tc.origin != "" {
			req.Header.Set("Origin", tc.origin)
		}
		rr := httptest.NewRecorder()
		secureLocal(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })).ServeHTTP(rr, req)
		if rr.Code != tc.expected {
			t.Errorf("host=%s token=%v origin=%s expected %d, got %d", tc.host, tc.token != "", tc.origin, tc.expected, rr.Code)
		}
	}
}
func TestSceneDataEmbedded(t *testing.T) {
	for _, name := range []string{"assets/scene-core.js", "assets/scene-renderer.js", "assets/app.js", "assets/countries.json"} {
		b, e := appFiles.ReadFile(name)
		if e != nil || len(b) < 100 {
			t.Fatalf("missing %s %v", name, e)
		}
	}
	var v []map[string]any
	raw, _ := appFiles.ReadFile("assets/countries.json")
	if json.Unmarshal(raw, &v) != nil || len(v) != 177 {
		t.Fatal("countries")
	}
}
