//go:build !installer

package main

// CartoRig 2.0 production services. All files remain local to the user's
// profile. Incoming data is bounded, verified, and atomically published.

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"image"
	"image/draw"
	"image/png"
	"strconv"

	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

const maxProjectBytes = 12 << 20
const maxExportEntry = 155 << 20
const maxExportEntries = 250
const maxExportTotal = 2 << 30

var productionId = regexp.MustCompile(`^[a-zA-Z0-9-]{10,80}$`)
var exportFileName = regexp.MustCompile(`^[a-zA-Z0-9_\-.]{1,120}\.(png|svg)$`)
var productionSessions = struct {
	sync.Mutex
	Items map[string]*exportJob
}{Items: make(map[string]*exportJob)}

type exportJob struct {
	Tiles    map[string][]exportTile `json:"-"`
	mu       sync.Mutex
	ID       string          `json:"id"`
	Root     string          `json:"-"`
	Width    int             `json:"width"`
	Height   int             `json:"height"`
	Created  time.Time       `json:"created"`
	Complete bool            `json:"complete"`
	Entries  []exportEntry   `json:"entries"`
	Project  json.RawMessage `json:"-"`
	Warnings []string        `json:"warnings,omitempty"`
	Total    int64           `json:"-"`
}
type exportTile struct {
	File          string
	X, Y          int
	Width, Height int
	CropX, CropY  int
}
type exportEntry struct {
	Path      string `json:"relative_path"`
	Width     int    `json:"width,omitempty"`
	Height    int    `json:"height,omitempty"`
	Sha256    string `json:"file_sha256"`
	Bytes     int64  `json:"size_bytes"`
	AlphaMode string `json:"alpha_mode,omitempty"`
}
type projectSnapshot struct {
	ID       string `json:"project_id"`
	Name     string `json:"name"`
	Revision int64  `json:"revision"`
	Schema   string `json:"schema_version"`
}

func productionDir() (string, error) {
	if p := os.Getenv("CARTORIG_DATA_DIR"); p != "" {
		return filepath.Abs(p)
	}
	p, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(p, "CartoRig"), nil
}
func productionPath(parts ...string) (string, error) {
	base, e := productionDir()
	if e != nil {
		return "", e
	}
	return filepath.Join(append([]string{base}, parts...)...), nil
}
func productionNonce() string {
	var buf [18]byte
	if _, err := rand.Read(buf[:]); err != nil {
		panic(err)
	}
	return hex.EncodeToString(buf[:])
}
func fileSHA(data []byte) string { sum := sha256.Sum256(data); return hex.EncodeToString(sum[:]) }
func respondJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
func backendError(w http.ResponseWriter, code int, msg string) {
	respondJSON(w, code, map[string]string{"error": msg})
}
func requireMethod(w http.ResponseWriter, r *http.Request, method string) bool {
	if r.Method != method {
		w.Header().Set("Allow", method)
		backendError(w, 405, "Method not allowed")
		return false
	}
	return true
}
func limitedJSON(w http.ResponseWriter, r *http.Request, max int64) ([]byte, error) {
	b, e := io.ReadAll(http.MaxBytesReader(w, r.Body, max))
	if e != nil {
		return nil, fmt.Errorf("request too large: %w", e)
	}
	if !json.Valid(b) {
		return nil, errors.New("invalid JSON")
	}
	return b, nil
}
func validateProjectJSON(b []byte) (projectSnapshot, error) {
	if len(b) == 0 || len(b) > maxProjectBytes {
		return projectSnapshot{}, errors.New("project exceeds size limit")
	}
	var doc struct {
		Format   string                     `json:"format"`
		Schema   string                     `json:"schema_version"`
		ID       string                     `json:"project_id"`
		Name     string                     `json:"name"`
		Revision int64                      `json:"revision"`
		Objects  map[string]json.RawMessage `json:"objects"`
		Scene    json.RawMessage            `json:"scene"`
	}
	if err := json.Unmarshal(b, &doc); err != nil {
		return projectSnapshot{}, err
	}
	if doc.Format != "cartorig-project" || !strings.HasPrefix(doc.Schema, "2.") || !productionId.MatchString(doc.ID) || len(doc.Name) > 240 || len(doc.Name) == 0 || len(doc.Objects) == 0 || len(doc.Objects) > 10000 || len(doc.Scene) == 0 {
		return projectSnapshot{}, errors.New("invalid or unsupported CartoRig project")
	}
	return projectSnapshot{ID: doc.ID, Name: doc.Name, Revision: doc.Revision, Schema: doc.Schema}, nil
}
func atomicSave(path string, write func(*os.File) error) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".cartorig-pending-*")
	if err != nil {
		return err
	}
	tmp := f.Name()
	defer os.Remove(tmp)
	if err = write(f); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	// A readable backup exists before replacing the last confirmed project.
	if _, err = os.Stat(path); err == nil {
		if data, e := os.ReadFile(path); e == nil {
			_ = os.WriteFile(path+".bak", data, 0600)
		}
	}
	return os.Rename(tmp, path)
}
func writeProjectZip(w io.Writer, data []byte, s projectSnapshot) error {
	z := zip.NewWriter(w)
	write := func(name string, data []byte) error {
		f, e := z.Create(name)
		if e != nil {
			return e
		}
		_, e = f.Write(data)
		return e
	}
	meta, _ := json.MarshalIndent(map[string]any{"format": "cartorig-package", "schema": "2.0.0", "project_id": s.ID, "revision": s.Revision, "sha256": fileSHA(data)}, "", "  ")
	if err := write("project.json", data); err != nil {
		return err
	}
	if err := write("project-meta.json", meta); err != nil {
		return err
	}
	if err := write("sources/README.txt", []byte("Geographic packages are supplied with CartoRig; resolve by dataset/version/hash.\n")); err != nil {
		return err
	}
	return z.Close()
}
func parseProjectInput(body []byte) ([]byte, error) {
	if len(body) < 4 || string(body[:2]) != "PK" {
		_, e := validateProjectJSON(body)
		return body, e
	}
	z, e := zip.NewReader(strings.NewReader(string(body)), int64(len(body)))
	if e != nil {
		return nil, e
	}
	if len(z.File) > 100 {
		return nil, errors.New("too many files in project")
	}
	var project []byte
	for _, f := range z.File {
		if f.Name == "" || strings.HasPrefix(f.Name, "/") || strings.Contains(f.Name, "\\") || strings.Contains(f.Name, "..") || f.UncompressedSize64 > maxProjectBytes || f.Mode()&os.ModeSymlink != 0 {
			return nil, errors.New("unsafe project archive")
		}
		if f.Name != "project.json" && f.Name != "project.cartorig" {
			continue
		}
		in, er := f.Open()
		if er != nil {
			return nil, er
		}
		project, er = io.ReadAll(io.LimitReader(in, maxProjectBytes+1))
		in.Close()
		if er != nil {
			return nil, er
		}
	}
	if len(project) == 0 {
		return nil, errors.New("project.json missing")
	}
	_, e = validateProjectJSON(project)
	return project, e
}
func projectSaveHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "POST") {
		return
	}
	data, e := limitedJSON(w, r, maxProjectBytes)
	if e != nil {
		backendError(w, 400, e.Error())
		return
	}
	s, e := validateProjectJSON(data)
	if e != nil {
		backendError(w, 400, e.Error())
		return
	}
	path, e := productionPath("Projects", s.ID+".cartorig")
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	e = atomicSave(path, func(f *os.File) error { return writeProjectZip(f, data, s) })
	if e != nil {
		backendError(w, 500, "Unable to save project: "+e.Error())
		return
	}
	respondJSON(w, 200, map[string]any{"ok": true, "project_id": s.ID, "revision": s.Revision, "location": path, "sha256": fileSHA(data)})
}
func projectOpenHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "POST") {
		return
	}
	data, e := io.ReadAll(http.MaxBytesReader(w, r.Body, 48<<20))
	if e != nil {
		backendError(w, 400, "project file too large")
		return
	}
	doc, e := parseProjectInput(data)
	if e != nil {
		backendError(w, 400, e.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Write(doc)
}
func readProject(id string) ([]byte, error) {
	if !productionId.MatchString(id) {
		return nil, errors.New("invalid project identifier")
	}
	path, e := productionPath("Projects", id+".cartorig")
	if e != nil {
		return nil, e
	}
	data, e := os.ReadFile(path)
	if e != nil {
		return nil, e
	}
	return parseProjectInput(data)
}
func projectDownloadHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "GET") {
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/v2/project/download/")
	if !productionId.MatchString(id) {
		backendError(w, 400, "invalid project id")
		return
	}
	path, e := productionPath("Projects", id+".cartorig")
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	if _, e = os.Stat(path); e != nil {
		backendError(w, 404, "project not found")
		return
	}
	w.Header().Set("Content-Disposition", `attachment; filename="CartoRig-Project.cartorig"`)
	w.Header().Set("Cache-Control", "no-store")
	http.ServeFile(w, r, path)
}
func autosaveHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "POST") {
		return
	}
	data, e := limitedJSON(w, r, maxProjectBytes)
	if e != nil {
		backendError(w, 400, e.Error())
		return
	}
	s, e := validateProjectJSON(data)
	if e != nil {
		backendError(w, 400, e.Error())
		return
	}
	p, e := productionPath("Autosaves", s.ID, "latest.json")
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	e = atomicSave(p, func(f *os.File) error { _, e := f.Write(data); return e })
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	respondJSON(w, 200, map[string]any{"ok": true, "id": s.ID, "revision": s.Revision, "sha256": fileSHA(data)})
}
// Delete only selected autosave snapshots. Never touch Projects/ or Templates/.
// Explicit IDs protect snapshots created after the recovery list was opened.
func recoveryDeleteHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "DELETE") {
		return
	}
	var request struct {
		IDs []string `json:"ids"`
	}
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil || len(request.IDs) == 0 || len(request.IDs) > 10000 {
		backendError(w, 400, "expected 1 to 10000 recovery ids")
		return
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		backendError(w, 400, "invalid recovery deletion request")
		return
	}
	unique := make(map[string]struct{}, len(request.IDs))
	for _, id := range request.IDs {
		if !productionId.MatchString(id) {
			backendError(w, 400, "invalid recovery id")
			return
		}
		unique[id] = struct{}{}
	}
	root, err := productionPath("Autosaves")
	if err != nil {
		backendError(w, 500, err.Error())
		return
	}
	// Validate all targets first so an invalid or linked directory cannot
	// result in partially deleting an otherwise valid batch.
	for id := range unique {
		dir := filepath.Join(root, id)
		info, e := os.Lstat(dir)
		if os.IsNotExist(e) {
			continue
		}
		if e != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			backendError(w, 400, "invalid recovery directory")
			return
		}
	}
	deleted, missing := 0, 0
	for id := range unique {
		dir := filepath.Join(root, id)
		found := false
		for _, name := range []string{"latest.json", "latest.json.bak"} {
			file := filepath.Join(dir, name)
			if err := os.Remove(file); err == nil {
				found = true
			} else if !os.IsNotExist(err) {
				backendError(w, 500, "could not delete recovery")
				return
			}
		}
		if found {
			deleted++
			// Only remove the directory when empty; unrelated files remain safe.
			_ = os.Remove(dir)
		} else {
			missing++
		}
	}
	respondJSON(w, 200, map[string]any{"deleted": deleted, "missing": missing})
}

func recoveryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodDelete {
		recoveryDeleteHandler(w, r)
		return
	}
	if !requireMethod(w, r, "GET") {
		return
	}
	root, e := productionPath("Autosaves")
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	dirs, e := os.ReadDir(root)
	if os.IsNotExist(e) {
		respondJSON(w, 200, []any{})
		return
	}
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	result := []map[string]any{}
	for _, d := range dirs {
		if !d.IsDir() || !productionId.MatchString(d.Name()) {
			continue
		}
		p := filepath.Join(root, d.Name(), "latest.json")
		data, er := os.ReadFile(p)
		if er != nil {
			continue
		}
		s, er := validateProjectJSON(data)
		if er != nil || s.ID != d.Name() {
			continue
		}
		saved, _ := readProject(s.ID)
		v, er := validateProjectJSON(saved)
		if er == nil && v.Revision >= s.Revision {
			continue
		}
		result = append(result, map[string]any{"id": s.ID, "name": s.Name, "revision": s.Revision, "saved_revision": v.Revision, "sha256": fileSHA(data)})
	}
	respondJSON(w, 200, result)
}
func recoveryOpenHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "GET") {
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/v2/recovery/")
	if !productionId.MatchString(id) {
		backendError(w, 400, "invalid id")
		return
	}
	p, e := productionPath("Autosaves", id, "latest.json")
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	data, e := os.ReadFile(p)
	if e != nil {
		backendError(w, 404, "recovery unavailable")
		return
	}
	if _, e = validateProjectJSON(data); e != nil {
		backendError(w, 400, e.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}
func recentProjectsHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "GET") {
		return
	}
	root, e := productionPath("Projects")
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	files, e := os.ReadDir(root)
	if os.IsNotExist(e) {
		respondJSON(w, 200, []any{})
		return
	}
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	out := []map[string]any{}
	for _, f := range files {
		if f.IsDir() || !strings.HasSuffix(f.Name(), ".cartorig") {
			continue
		}
		id := strings.TrimSuffix(f.Name(), ".cartorig")
		if !productionId.MatchString(id) {
			continue
		}
		data, er := readProject(id)
		if er != nil {
			continue
		}
		s, er := validateProjectJSON(data)
		if er != nil {
			continue
		}
		info, _ := f.Info()
		out = append(out, map[string]any{"id": id, "name": s.Name, "revision": s.Revision, "modified": info.ModTime().UTC().Format(time.RFC3339)})
	}
	sort.Slice(out, func(i, j int) bool { return out[i]["modified"].(string) > out[j]["modified"].(string) })
	if len(out) > 20 {
		out = out[:20]
	}
	respondJSON(w, 200, out)
}
func projectLoadHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "GET") {
		return
	}
	doc, e := readProject(r.URL.Query().Get("id"))
	if e != nil {
		backendError(w, 404, "project unavailable")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(doc)
}

func saveTemplateHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "POST") {
		return
	}
	data, e := limitedJSON(w, r, maxProjectBytes)
	if e != nil {
		backendError(w, 400, e.Error())
		return
	}
	s, e := validateProjectJSON(data)
	if e != nil {
		backendError(w, 400, e.Error())
		return
	}
	// Template identity is independent from project identity. The file is a
	// recoverable user asset, never executable content or a code plugin.
	id := productionNonce()
	path, e := productionPath("Templates", id+".cartorig")
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	if e = atomicSave(path, func(f *os.File) error { return writeProjectZip(f, data, s) }); e != nil {
		backendError(w, 500, e.Error())
		return
	}
	respondJSON(w, 201, map[string]any{"ok": true, "id": id, "name": s.Name})
}
func listTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "GET") {
		return
	}
	root, e := productionPath("Templates")
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	files, e := os.ReadDir(root)
	if os.IsNotExist(e) {
		respondJSON(w, 200, []any{})
		return
	}
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	out := []map[string]any{}
	for _, f := range files {
		if !strings.HasSuffix(f.Name(), ".cartorig") {
			continue
		}
		id := strings.TrimSuffix(f.Name(), ".cartorig")
		if !productionId.MatchString(id) {
			continue
		}
		p := filepath.Join(root, f.Name())
		data, e := os.ReadFile(p)
		if e != nil {
			continue
		}
		raw, e := parseProjectInput(data)
		if e != nil {
			continue
		}
		s, e := validateProjectJSON(raw)
		if e != nil {
			continue
		}
		out = append(out, map[string]any{"id": id, "name": s.Name})
	}
	respondJSON(w, 200, out)
}
func openTemplateHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "GET") {
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/v2/project/template/")
	if !productionId.MatchString(id) {
		backendError(w, 400, "invalid template id")
		return
	}
	path, e := productionPath("Templates", id+".cartorig")
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	data, e := os.ReadFile(path)
	if e != nil {
		backendError(w, 404, "template unavailable")
		return
	}
	raw, e := parseProjectInput(data)
	if e != nil {
		backendError(w, 400, "template damaged")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(raw)
}

func createExportHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "POST") {
		return
	}
	data, e := limitedJSON(w, r, maxProjectBytes+4096)
	if e != nil {
		backendError(w, 400, e.Error())
		return
	}
	var x struct {
		Width    int             `json:"width"`
		Height   int             `json:"height"`
		Project  json.RawMessage `json:"project"`
		Warnings []string        `json:"warnings"`
	}
	if e = json.Unmarshal(data, &x); e != nil {
		backendError(w, 400, e.Error())
		return
	}
	if x.Width < 64 || x.Height < 64 || x.Width > 10000 || x.Height > 10000 || int64(x.Width)*int64(x.Height) > 60_000_000 || len(x.Warnings) > 100 {
		backendError(w, 400, "invalid composition dimensions")
		return
	}
	if _, e = validateProjectJSON(x.Project); e != nil {
		backendError(w, 400, e.Error())
		return
	}
	root, e := productionPath("Exports", productionNonce())
	if e != nil {
		backendError(w, 500, e.Error())
		return
	}
	if e = os.MkdirAll(root, 0700); e != nil {
		backendError(w, 500, e.Error())
		return
	}
	id := filepath.Base(root)
	job := &exportJob{ID: id, Root: root, Width: x.Width, Height: x.Height, Created: time.Now(), Project: x.Project, Warnings: x.Warnings, Tiles: make(map[string][]exportTile)}
	productionSessions.Lock()
	productionSessions.Items[id] = job
	productionSessions.Unlock()
	respondJSON(w, 201, map[string]any{"id": id, "status": "created"})
}
func getJob(id string) (*exportJob, bool) {
	productionSessions.Lock()
	defer productionSessions.Unlock()
	job, ok := productionSessions.Items[id]
	return job, ok
}
func exportSessionHandler(w http.ResponseWriter, r *http.Request) {
	suffix := strings.TrimPrefix(r.URL.Path, "/api/v2/export/session/")
	bits := strings.Split(strings.Trim(suffix, "/"), "/")
	if len(bits) == 0 || !productionId.MatchString(bits[0]) {
		backendError(w, 400, "invalid session")
		return
	}
	job, ok := getJob(bits[0])
	if !ok {
		backendError(w, 404, "session not found")
		return
	}
	if r.Method == http.MethodDelete && len(bits) == 1 {
		job.mu.Lock()
		defer job.mu.Unlock()
		productionSessions.Lock()
		delete(productionSessions.Items, job.ID)
		productionSessions.Unlock()
		_ = os.RemoveAll(job.Root)
		respondJSON(w, 200, map[string]bool{"canceled": true})
		return
	}
	if len(bits) != 2 {
		backendError(w, 404, "unknown endpoint")
		return
	}
	switch bits[1] {
	case "entry":
		exportEntryHandler(w, r, job)
	case "tile":
		exportTileHandler(w, r, job)
	case "finish":
		exportFinishHandler(w, r, job)
	default:
		backendError(w, 404, "unknown endpoint")
	}
}

// Only a limited, presentational SVG subset is accepted from the browser.
// Imported scripts, foreignObject, executable URLs and entity expansion are
// rejected before writing any file to disk.
func validateSafeSVG(data []byte) error {
	if len(data) > 8<<20 || len(data) < 12 {
		return errors.New("SVG outside size limit")
	}
	dec := xml.NewDecoder(bytes.NewReader(data))
	allowed := map[string]bool{"svg": true, "metadata": true, "path": true, "circle": true, "text": true, "tspan": true, "g": true, "rect": true, "line": true, "polygon": true, "polyline": true, "ellipse": true}
	root := false
	for {
		token, e := dec.Token()
		if e == io.EOF {
			break
		}
		if e != nil {
			return errors.New("malformed SVG")
		}
		if d, ok := token.(xml.Directive); ok && len(d) > 0 {
			return errors.New("SVG directives are not allowed")
		}
		el, ok := token.(xml.StartElement)
		if !ok {
			continue
		}
		if !allowed[el.Name.Local] {
			return errors.New("unsupported SVG element: " + el.Name.Local)
		}
		if !root {
			if el.Name.Local != "svg" {
				return errors.New("missing SVG root")
			}
			root = true
		}
		for _, a := range el.Attr {
			key := strings.ToLower(a.Name.Local)
			val := strings.ToLower(strings.TrimSpace(a.Value))
			if key == "xmlns" && val == "http://www.w3.org/2000/svg" {
				continue
			}
			if strings.HasPrefix(key, "on") || key == "href" || strings.Contains(val, "url(") || strings.Contains(val, "javascript:") || strings.Contains(val, "file:") || strings.Contains(val, "http:") || strings.Contains(val, "https:") || strings.Contains(val, "data:") || key == "style" {
				return errors.New("unsafe SVG attribute")
			}
		}
	}
	if !root {
		return errors.New("missing SVG content")
	}
	return nil
}

func exportEntryHandler(w http.ResponseWriter, r *http.Request, job *exportJob) {
	job.mu.Lock()
	defer job.mu.Unlock()
	if !requireMethod(w, r, "POST") {
		return
	}
	name := r.URL.Query().Get("name")
	if !exportFileName.MatchString(name) || name == "." || name == ".." {
		backendError(w, 400, "unsafe export filename")
		return
	}
	if job.Complete || len(job.Entries) >= maxExportEntries {
		backendError(w, 409, "session complete or too many entries")
		return
	}
	for _, x := range job.Entries {
		if x.Path == name {
			backendError(w, 409, "duplicate export filename")
			return
		}
	}
	data, e := io.ReadAll(http.MaxBytesReader(w, r.Body, maxExportEntry))
	if e != nil || len(data) < 8 || job.Total+int64(len(data)) > maxExportTotal {
		backendError(w, 400, "file too large")
		return
	}
	width, height := 0, 0
	if strings.HasSuffix(name, ".png") {
		if string(data[:8]) != "\x89PNG\r\n\x1a\n" {
			backendError(w, 400, "invalid PNG signature")
			return
		}
		cfg, format, er := image.DecodeConfig(strings.NewReader(string(data)))
		if er != nil || format != "png" || cfg.Width != job.Width || cfg.Height != job.Height {
			backendError(w, 400, "PNG dimensions do not match output")
			return
		}
		width, height = cfg.Width, cfg.Height
	} else {
		if err := validateSafeSVG(data); err != nil {
			backendError(w, 400, err.Error())
			return
		}

	}
	path := filepath.Join(job.Root, name)
	if e = atomicSave(path, func(f *os.File) error { _, e := f.Write(data); return e }); e != nil {
		backendError(w, 500, e.Error())
		return
	}
	job.Entries = append(job.Entries, exportEntry{Path: name, Width: width, Height: height, Sha256: fileSHA(data), Bytes: int64(len(data)), AlphaMode: "straight"})
	job.Total += int64(len(data))
	respondJSON(w, 201, map[string]any{"ok": true, "file": name, "sha256": fileSHA(data), "entries": len(job.Entries)})
}

// A tiled render uses 1024px full-frame cells, optional overscan to protect
// blur/glow edges, and the same camera/projection for every tile. The browser
// only needs a small Canvas while Go recomposes one RGBA frame at a time.
func exportTileHandler(w http.ResponseWriter, r *http.Request, job *exportJob) {
	job.mu.Lock()
	defer job.mu.Unlock()
	if !requireMethod(w, r, "POST") {
		return
	}
	name := r.URL.Query().Get("name")
	if !exportFileName.MatchString(name) || !strings.HasSuffix(name, ".png") {
		backendError(w, 400, "invalid tile output filename")
		return
	}
	parse := func(key string) int {
		v, e := strconv.Atoi(r.URL.Query().Get(key))
		if e != nil {
			return -1
		}
		return v
	}
	x, y, cx, cy := parse("x"), parse("y"), parse("cx"), parse("cy")
	if x < 0 || y < 0 || x >= job.Width || y >= job.Height || x%1024 != 0 || y%1024 != 0 || cx < 0 || cy < 0 || job.Complete {
		backendError(w, 400, "invalid tile placement")
		return
	}
	tw := min(1024, job.Width-x)
	th := min(1024, job.Height-y)
	for _, existing := range job.Tiles[name] {
		if existing.X == x && existing.Y == y {
			backendError(w, 409, "duplicate tile")
			return
		}
	}
	raw, e := io.ReadAll(http.MaxBytesReader(w, r.Body, 32<<20))
	if e != nil || job.Total+int64(len(raw)) > maxExportTotal || len(raw) < 8 {
		backendError(w, 400, "tile exceeds size limit")
		return
	}
	cfg, format, e := image.DecodeConfig(bytes.NewReader(raw))
	if e != nil || format != "png" || cfg.Width > 3072 || cfg.Height > 3072 || cfg.Width < tw || cfg.Height < th || cx+tw > cfg.Width || cy+th > cfg.Height {
		backendError(w, 400, "invalid tile PNG dimensions")
		return
	}
	fname := fmt.Sprintf("tile_%s_%d_%d.png", strings.TrimSuffix(name, ".png"), x, y)
	path := filepath.Join(job.Root, fname)
	if e = atomicSave(path, func(f *os.File) error { _, e := f.Write(raw); return e }); e != nil {
		backendError(w, 500, e.Error())
		return
	}
	job.Tiles[name] = append(job.Tiles[name], exportTile{File: fname, X: x, Y: y, Width: tw, Height: th, CropX: cx, CropY: cy})
	job.Total += int64(len(raw))
	respondJSON(w, 201, map[string]any{"ok": true, "name": name, "x": x, "y": y, "received": len(job.Tiles[name])})
}
func assembleTiles(job *exportJob) error {
	keys := make([]string, 0, len(job.Tiles))
	for name := range job.Tiles {
		keys = append(keys, name)
	}
	sort.Strings(keys)
	for _, name := range keys {
		tiles := job.Tiles[name]
		if len(tiles) != ((job.Width+1023)/1024)*((job.Height+1023)/1024) {
			return errors.New("export tile set incomplete: " + name)
		}
		result := image.NewRGBA(image.Rect(0, 0, job.Width, job.Height))
		for _, t := range tiles {
			src, err := os.Open(filepath.Join(job.Root, t.File))
			if err != nil {
				return err
			}
			im, err := png.Decode(src)
			src.Close()
			if err != nil {
				return err
			}
			rect := image.Rect(t.X, t.Y, t.X+t.Width, t.Y+t.Height)
			draw.Draw(result, rect, im, image.Point{X: t.CropX, Y: t.CropY}, draw.Src)
		}
		path := filepath.Join(job.Root, name)
		if err := atomicSave(path, func(f *os.File) error { return png.Encode(f, result) }); err != nil {
			return err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		job.Entries = append(job.Entries, exportEntry{Path: name, Width: job.Width, Height: job.Height, Bytes: int64(len(data)), Sha256: fileSHA(data), AlphaMode: "straight"})
		for _, t := range tiles {
			_ = os.Remove(filepath.Join(job.Root, t.File))
		}
	}
	job.Tiles = make(map[string][]exportTile)
	return nil
}

func exportFinishHandler(w http.ResponseWriter, r *http.Request, job *exportJob) {
	job.mu.Lock()
	defer job.mu.Unlock()
	if !requireMethod(w, r, "POST") {
		return
	}
	if job.Complete {
		backendError(w, 409, "empty or completed session")
		return
	}
	if err := assembleTiles(job); err != nil {
		backendError(w, 400, err.Error())
		return
	}
	if len(job.Entries) == 0 {
		backendError(w, 409, "empty export session")
		return
	}
	packageFile := filepath.Join(job.Root, "CartoRig-Production.zip")
	entries := append([]exportEntry(nil), job.Entries...)
	var projectMeta struct {
		Camera            json.RawMessage `json:"camera"`
		Theme             json.RawMessage `json:"theme"`
		GeoDataManifestID string          `json:"geodata_manifest_id"`
	}
	_ = json.Unmarshal(job.Project, &projectMeta)
	sort.SliceStable(entries, func(i, j int) bool { return entries[i].Path < entries[j].Path })
	manifest, _ := json.MarshalIndent(map[string]any{"camera": projectMeta.Camera, "theme": projectMeta.Theme, "geodata_manifest_id": projectMeta.GeoDataManifestID, "format": "cartorig-export", "schema_version": "2.0.0", "app_version": version, "width": job.Width, "height": job.Height, "projection": "equirectangular", "color_space": "sRGB", "entries": entries, "created_at": time.Now().UTC().Format(time.RFC3339), "warnings": job.Warnings}, "", "  ")
	e := atomicSave(packageFile, func(f *os.File) error {
		z := zip.NewWriter(f)
		add := func(name string, data []byte) error {
			wr, e := z.Create(name)
			if e != nil {
				return e
			}
			_, e = wr.Write(data)
			return e
		}
		if e := add("CartoRig/manifest.json", manifest); e != nil {
			return e
		}
		if e := add("CartoRig/project.json", job.Project); e != nil {
			return e
		}
		var pmeta projectSnapshot
		pmeta, _ = validateProjectJSON(job.Project)
		var projectBuf bytes.Buffer
		if e := writeProjectZip(&projectBuf, job.Project, pmeta); e != nil {
			return e
		}
		if e := add("CartoRig/project.cartorig", projectBuf.Bytes()); e != nil {
			return e
		}
		if src, e := appFiles.ReadFile("assets/geodata/manifest.json"); e == nil {
			if e = add("CartoRig/data/source-manifest.json", src); e != nil {
				return e
			}
		}

		if e := add("CartoRig/docs/IMPORT_GUIDE.md", []byte("CartoRig 2.0 export: All PNGs share output dimensions and camera. Align at 100% scale and canvas center; compositing order is manifest entries order. Animations belong in an external video editor.\n")); e != nil {
			return e
		}
		for _, en := range entries {
			src, er := os.Open(filepath.Join(job.Root, en.Path))
			if er != nil {
				return er
			}
			folder := "layers/"
			if en.Path == "final.png" {
				folder = ""
			} else if strings.HasPrefix(en.Path, "mask_") {
				folder = "masks/"
			} else if strings.HasSuffix(en.Path, ".svg") {
				folder = "vector/"
			}
			dst, er := z.Create("CartoRig/" + folder + en.Path)
			if er != nil {
				src.Close()
				return er
			}
			hash := sha256.New()
			_, er = io.Copy(io.MultiWriter(dst, hash), src)
			src.Close()
			if er != nil {
				return er
			}
			if hex.EncodeToString(hash.Sum(nil)) != en.Sha256 {
				return errors.New("export entry checksum changed")
			}
		}
		return z.Close()
	})
	if e != nil {
		backendError(w, 500, "failed to package export: "+e.Error())
		return
	}
	if f, e := os.Open(packageFile); e == nil {
		z, e := zip.NewReader(f, mustFileSize(f))
		f.Close()
		if e != nil || len(z.File) < 4 {
			backendError(w, 500, "export archive validation failed")
			return
		}
	}
	job.Complete = true
	respondJSON(w, 200, map[string]any{"complete": true, "id": job.ID, "entries": len(entries), "size_bytes": fileSize(packageFile)})
}
func mustFileSize(f *os.File) int64 { st, _ := f.Stat(); return st.Size() }
func fileSize(p string) int64 {
	st, e := os.Stat(p)
	if e != nil {
		return 0
	}
	return st.Size()
}
func exportDownloadHandler(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, "GET") {
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/v2/export/download/")
	if !productionId.MatchString(id) {
		backendError(w, 400, "invalid export id")
		return
	}
	job, ok := getJob(id)
	if !ok || !job.Complete {
		backendError(w, 404, "export unavailable")
		return
	}
	w.Header().Set("Content-Disposition", `attachment; filename="CartoRig-Production.zip"`)
	w.Header().Set("Cache-Control", "no-store")
	http.ServeFile(w, r, filepath.Join(job.Root, "CartoRig-Production.zip"))
}

func registerProduction(mux *http.ServeMux) {
	mux.HandleFunc("/api/v2/health", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, 200, map[string]any{"name": "CartoRig", "version": version, "offline": true, "schema_version": "2.0.0"})
	})
	mux.HandleFunc("/api/v2/project/save", projectSaveHandler)
	mux.HandleFunc("/api/v2/project/open", projectOpenHandler)
	mux.HandleFunc("/api/v2/project/download/", projectDownloadHandler)
	mux.HandleFunc("/api/v2/project/recent", recentProjectsHandler)
	mux.HandleFunc("/api/v2/project/load", projectLoadHandler)
	mux.HandleFunc("/api/v2/autosave", autosaveHandler)
	mux.HandleFunc("/api/v2/project/template", saveTemplateHandler)
	mux.HandleFunc("/api/v2/project/templates", listTemplatesHandler)
	mux.HandleFunc("/api/v2/project/template/", openTemplateHandler)
	mux.HandleFunc("/api/v2/recovery", recoveryHandler)
	mux.HandleFunc("/api/v2/recovery/", recoveryOpenHandler)
	mux.HandleFunc("/api/v2/export/session", createExportHandler)
	mux.HandleFunc("/api/v2/export/session/", exportSessionHandler)
	mux.HandleFunc("/api/v2/export/download/", exportDownloadHandler)
}
