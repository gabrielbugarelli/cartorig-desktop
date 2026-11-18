//go:build !installer

package main

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealth(t *testing.T) {
	r := httptest.NewRecorder()
	newMux().ServeHTTP(r, httptest.NewRequest("GET", "/api/health", nil))
	if r.Code != 200 || !bytes.Contains(r.Body.Bytes(), []byte(`"offline":true`)) {
		t.Fatalf("health %d %s", r.Code, r.Body.String())
	}
}
func TestStaticAssets(t *testing.T) {
	for _, path := range []string{"/", "/assets/countries.json", "/assets/shadedrelief.jpg", "/assets/app.js"} {
		r := httptest.NewRecorder()
		newMux().ServeHTTP(r, httptest.NewRequest("GET", path, nil))
		if r.Code != 200 || r.Body.Len() < 100 {
			t.Fatalf("%s %d %d", path, r.Code, r.Body.Len())
		}
	}
}
func TestBundle(t *testing.T) {
	var b bytes.Buffer
	mw := multipart.NewWriter(&b)
	_ = mw.WriteField("project", `{"name":"test"}`)
	f, _ := mw.CreateFormFile("final", "final.png")
	_, _ = f.Write(append([]byte("\x89PNG"), make([]byte, 20)...))
	_ = mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/bundle", &b)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	r := httptest.NewRecorder()
	createBundle(r, req)
	if r.Code != 200 {
		t.Fatal(r.Code)
	}
	body, _ := io.ReadAll(r.Result().Body)
	if !bytes.HasPrefix(body, []byte("PK")) {
		t.Fatal("ZIP not present")
	}
}
func TestCountryData(t *testing.T) {
	raw, _ := appFiles.ReadFile("assets/countries.json")
	var countries []map[string]any
	if err := json.Unmarshal(raw, &countries); err != nil || len(countries) < 170 {
		t.Fatalf("countries %v: %d", err, len(countries))
	}
}
