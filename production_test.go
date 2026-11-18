//go:build !installer

package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const testProjectID = "e53517e4-4ce8-49fb-bceb-49dc9665a186"

func productionProject(rev int) []byte {
	s := `{"format":"cartorig-project","schema_version":"2.0.0","project_id":"` + testProjectID + `","name":"Test Map","revision":0,"scene":{"root_ids":["world"]},"objects":{"world":{"id":"world","type":"WorldMap"}}}`
	var p map[string]any
	_ = json.Unmarshal([]byte(s), &p)
	p["revision"] = rev
	b, _ := json.Marshal(p)
	return b
}
func requestProduction(t *testing.T, mux *http.ServeMux, method, path string, body []byte, token bool) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, "http://127.0.0.1:12345"+path, bytes.NewReader(body))
	if token {
		req.Header.Set("X-CartoRig-Token", sessionToken)
	}
	rr := httptest.NewRecorder()
	secureLocal(mux).ServeHTTP(rr, req)
	return rr
}
func TestProductionProjectSafetyAndRecovery(t *testing.T) {
	t.Setenv("CARTORIG_DATA_DIR", t.TempDir())
	mux := newMux()
	project := productionProject(7)
	if rr := requestProduction(t, mux, "POST", "/api/v2/project/save", project, false); rr.Code != 403 {
		t.Fatalf("missing token code %d", rr.Code)
	}
	rr := requestProduction(t, mux, "POST", "/api/v2/project/save", project, true)
	if rr.Code != 200 {
		t.Fatalf("save: %d %s", rr.Code, rr.Body.String())
	}
	saved, err := productionPath("Projects", testProjectID+".cartorig")
	if err != nil {
		t.Fatal(err)
	}
	z, err := zip.OpenReader(saved)
	if err != nil {
		t.Fatal(err)
	}
	if len(z.File) < 2 {
		t.Fatalf("zip entries %d", len(z.File))
	}
	z.Close()
	rr = requestProduction(t, mux, "GET", "/api/v2/project/load?id="+testProjectID, nil, true)
	if rr.Code != 200 || !bytes.Equal(rr.Body.Bytes(), project) {
		t.Fatalf("project load: %d %s", rr.Code, rr.Body.String())
	}
	rr = requestProduction(t, mux, "POST", "/api/v2/project/save", []byte(`{"format":"wrong"}`), true)
	if rr.Code != 400 {
		t.Fatal("invalid save not rejected")
	}
	rr = requestProduction(t, mux, "GET", "/api/v2/project/load?id="+testProjectID, nil, true)
	if rr.Code != 200 {
		t.Fatal("valid saved file was destroyed by invalid request")
	}
	rr = requestProduction(t, mux, "POST", "/api/v2/autosave", productionProject(8), true)
	if rr.Code != 200 {
		t.Fatalf("autosave: %s", rr.Body.String())
	}
	rr = requestProduction(t, mux, "GET", "/api/v2/recovery", nil, true)
	if rr.Code != 200 || !strings.Contains(rr.Body.String(), testProjectID) {
		t.Fatal("recovery not listed", rr.Body.String())
	}
	rr = requestProduction(t, mux, "GET", "/api/v2/recovery/"+testProjectID, nil, true)
	if rr.Code != 200 || !strings.Contains(rr.Body.String(), `"revision":8`) {
		t.Fatal("recovery document unavailable")
	}
	if r := requestProduction(t, mux, "GET", "/api/v2/project/download/"+testProjectID, nil, true); r.Code != 200 {
		t.Fatal("project download failed", r.Code)
	}
}
func TestProductionProjectZipTraversalRejected(t *testing.T) {
	mux := newMux()
	var b bytes.Buffer
	z := zip.NewWriter(&b)
	f, err := z.Create("../project.json")
	if err != nil {
		t.Fatal(err)
	}
	f.Write(productionProject(1))
	z.Close()
	rr := requestProduction(t, mux, "POST", "/api/v2/project/open", b.Bytes(), true)
	if rr.Code != 400 {
		t.Fatalf("zip traversal allowed: %d", rr.Code)
	}
	b.Reset()
	z = zip.NewWriter(&b)
	f, _ = z.Create("project.json")
	f.Write(productionProject(1))
	z.Close()
	rr = requestProduction(t, mux, "POST", "/api/v2/project/open", b.Bytes(), true)
	if rr.Code != 200 {
		t.Fatal("legitimate project archive rejected", rr.Body.String())
	}
}
func TestProductionExportSessionLifecycle(t *testing.T) {
	t.Setenv("CARTORIG_DATA_DIR", t.TempDir())
	mux := newMux()
	project := productionProject(1)
	data, _ := json.Marshal(map[string]any{"width": 64, "height": 64, "project": json.RawMessage(project)})
	rr := requestProduction(t, mux, "POST", "/api/v2/export/session", data, true)
	if rr.Code != 201 {
		t.Fatal("start", rr.Code, rr.Body.String())
	}
	var response struct {
		ID string `json:"id"`
	}
	json.Unmarshal(rr.Body.Bytes(), &response)
	id := response.ID
	// No incomplete export may be downloaded before finish.
	rr = requestProduction(t, mux, "GET", "/api/v2/export/download/"+id, nil, true)
	if rr.Code != 404 {
		t.Fatal("incomplete export downloadable")
	}
	img := image.NewRGBA(image.Rect(0, 0, 64, 64))
	img.Set(1, 1, color.RGBA{R: 255, A: 255})
	var pngBytes bytes.Buffer
	if err := png.Encode(&pngBytes, img); err != nil {
		t.Fatal(err)
	}
	rr = requestProduction(t, mux, "POST", "/api/v2/export/session/"+id+"/entry?name=final.png", pngBytes.Bytes(), true)
	if rr.Code != 201 {
		t.Fatal("entry", rr.Code, rr.Body.String())
	}
	rr = requestProduction(t, mux, "POST", "/api/v2/export/session/"+id+"/entry?name=final.png", pngBytes.Bytes(), true)
	if rr.Code != 409 {
		t.Fatal("duplicate entry accepted")
	}
	rr = requestProduction(t, mux, "POST", "/api/v2/export/session/"+id+"/entry?name=../evil.png", pngBytes.Bytes(), true)
	if rr.Code != 400 {
		t.Fatal("path traversal accepted")
	}
	rr = requestProduction(t, mux, "POST", "/api/v2/export/session/"+id+"/finish", nil, true)
	if rr.Code != 200 {
		t.Fatal("finish", rr.Code, rr.Body.String())
	}
	rr = requestProduction(t, mux, "GET", "/api/v2/export/download/"+id, nil, true)
	if rr.Code != 200 {
		t.Fatal("download", rr.Code)
	}
	z, err := zip.NewReader(bytes.NewReader(rr.Body.Bytes()), int64(rr.Body.Len()))
	if err != nil {
		t.Fatal(err)
	}
	if len(z.File) < 4 {
		t.Fatalf("expected manifest+project+readme+image: %d", len(z.File))
	}
	names := map[string]bool{}
	for _, x := range z.File {
		names[x.Name] = true
		if x.Name == "CartoRig/final.png" {
			f, _ := x.Open()
			all, _ := io.ReadAll(f)
			f.Close()
			if !bytes.Equal(all, pngBytes.Bytes()) {
				t.Fatal("PNG bytes modified")
			}
		}
	}
	if !names["CartoRig/final.png"] {
		t.Fatal("final PNG not in zip")
	}
	rr = requestProduction(t, mux, "DELETE", "/api/v2/export/session/"+id, nil, true)
	if rr.Code != 200 {
		t.Fatal("delete failed")
	}
	if _, err := os.Stat(filepath.Join(os.Getenv("CARTORIG_DATA_DIR"), "Exports", id)); !os.IsNotExist(err) {
		t.Fatal("temporary export not deleted", err)
	}
}
func TestProductionExternalOriginBlocked(t *testing.T) {
	t.Setenv("CARTORIG_DATA_DIR", t.TempDir())
	mux := newMux()
	r := httptest.NewRequest("POST", "http://127.0.0.1:12345/api/v2/project/save", bytes.NewReader(productionProject(1)))
	r.Header.Set("X-CartoRig-Token", sessionToken)
	r.Header.Set("Origin", "https://evil.invalid")
	rr := httptest.NewRecorder()
	secureLocal(mux).ServeHTTP(rr, r)
	if rr.Code != 403 {
		t.Fatal("external origin not denied")
	}
}

func TestProductionTiledExportReassemblesPixels(t *testing.T) {
	t.Setenv("CARTORIG_DATA_DIR", t.TempDir())
	mux := newMux()
	project := productionProject(2)
	data, _ := json.Marshal(map[string]any{"width": 1088, "height": 1088, "project": json.RawMessage(project)})
	rr := requestProduction(t, mux, "POST", "/api/v2/export/session", data, true)
	if rr.Code != 201 {
		t.Fatalf("start %s", rr.Body.String())
	}
	var state struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &state)
	for y := 0; y < 1088; y += 1024 {
		for x := 0; x < 1088; x += 1024 {
			tw := min(1024, 1088-x)
			th := min(1024, 1088-y)
			margin := 10
			left := max(0, x-margin)
			top := max(0, y-margin)
			right := min(1088, x+tw+margin)
			bottom := min(1088, y+th+margin)
			tile := image.NewRGBA(image.Rect(0, 0, right-left, bottom-top))
			for yy := 0; yy < tile.Bounds().Dy(); yy++ {
				for xx := 0; xx < tile.Bounds().Dx(); xx++ {
					gx, gy := left+xx, top+yy
					tile.Set(xx, yy, color.RGBA{R: uint8(gx % 255), G: uint8(gy % 255), B: 90, A: 255})
				}
			}
			var buf bytes.Buffer
			if err := png.Encode(&buf, tile); err != nil {
				t.Fatal(err)
			}
			path := fmt.Sprintf("/api/v2/export/session/%s/tile?name=final.png&x=%d&y=%d&cx=%d&cy=%d", state.ID, x, y, x-left, y-top)
			rr = requestProduction(t, mux, "POST", path, buf.Bytes(), true)
			if rr.Code != 201 {
				t.Fatalf("tile %d,%d: %d %s", x, y, rr.Code, rr.Body.String())
			}
		}
	}
	rr = requestProduction(t, mux, "POST", "/api/v2/export/session/"+state.ID+"/finish", nil, true)
	if rr.Code != 200 {
		t.Fatalf("finish: %d %s", rr.Code, rr.Body.String())
	}
	rr = requestProduction(t, mux, "GET", "/api/v2/export/download/"+state.ID, nil, true)
	if rr.Code != 200 {
		t.Fatalf("download %d", rr.Code)
	}
	z, err := zip.NewReader(bytes.NewReader(rr.Body.Bytes()), int64(rr.Body.Len()))
	if err != nil {
		t.Fatal(err)
	}
	var output image.Image
	for _, f := range z.File {
		if f.Name != "CartoRig/final.png" {
			continue
		}
		in, e := f.Open()
		if e != nil {
			t.Fatal(e)
		}
		output, e = png.Decode(in)
		in.Close()
		if e != nil {
			t.Fatal(e)
		}
	}
	if output == nil || output.Bounds().Dx() != 1088 || output.Bounds().Dy() != 1088 {
		t.Fatal("output size or tile assembly failed")
	}
	for _, xy := range [][2]int{{0, 0}, {1019, 1019}, {1023, 1023}, {1024, 1024}, {1087, 1087}, {514, 1024}, {1024, 514}} {
		x, y := xy[0], xy[1]
		r, g, b, a := output.At(x, y).RGBA()
		if r>>8 != uint32(x%255) || g>>8 != uint32(y%255) || b>>8 != 90 || a != 65535 {
			t.Fatalf("tile seam pixel mismatch %d,%d = (%d,%d,%d,%d)", x, y, r>>8, g>>8, b>>8, a)
		}
	}
}

func TestProductionSVGRejectsExecutablePayload(t *testing.T) {
	good := []byte(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M0 0 L2 2" fill="none"/></svg>`)
	if e := validateSafeSVG(good); e != nil {
		t.Fatal("safe vector rejected:", e)
	}
	for _, bad := range []string{
		`<svg><script>alert(1)</script></svg>`,
		`<svg><path onload="alert(1)"/></svg>`,
		`<svg><image href="https://evil.example/steal"/></svg>`,
		`<svg><foreignObject/></svg>`,
		`<svg><path style="fill:url(javascript:x)"/></svg>`,
		`<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>`,
	} {
		if e := validateSafeSVG([]byte(bad)); e == nil {
			t.Errorf("unsafe SVG accepted: %s", bad)
		}
	}
}
func TestProductionTemplateStoredAndListed(t *testing.T) {
	t.Setenv("CARTORIG_DATA_DIR", t.TempDir())
	mux := newMux()
	project := productionProject(1)
	rr := requestProduction(t, mux, "POST", "/api/v2/project/template", project, true)
	if rr.Code != 201 {
		t.Fatal("template save", rr.Body.String())
	}
	var result struct {
		ID string `json:"id"`
	}
	json.Unmarshal(rr.Body.Bytes(), &result)
	rr = requestProduction(t, mux, "GET", "/api/v2/project/templates", nil, true)
	if rr.Code != 200 || !strings.Contains(rr.Body.String(), result.ID) {
		t.Fatal("template missing", rr.Body.String())
	}
	rr = requestProduction(t, mux, "GET", "/api/v2/project/template/"+result.ID, nil, true)
	if rr.Code != 200 || !bytes.Equal(rr.Body.Bytes(), project) {
		t.Fatal("template does not restore project")
	}
}
