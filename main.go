//go:build !installer

package main

import (
	"archive/zip"
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

// Bundled cartographic data, textures and interface. No Internet required.
//
//go:embed assets
var appFiles embed.FS

const version = "2.0.4.1"
const preferredAddress = "127.0.0.1:0"

var sessionToken = makeSessionToken()

func makeSessionToken() string {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b[:])
}

func main() {
	noBrowser := false
	for _, arg := range os.Args[1:] {
		if arg == "--no-browser" {
			noBrowser = true
		}
	}
	listener, err := net.Listen("tcp", preferredAddress)
	if err != nil {
		log.Fatal(err)
	}
	mux := newMux()
	server := &http.Server{Handler: secureLocal(mux), ReadHeaderTimeout: 10 * time.Second}
	mux.HandleFunc("/api/quit", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", 405)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
		go func() {
			time.Sleep(100 * time.Millisecond)
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			_ = server.Shutdown(ctx)
		}()
	})
	url := "http://" + listener.Addr().String()
	fmt.Println("CartoRig " + version + " — " + url)
	if !noBrowser {
		launchBrowser(url)
	}
	if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func newMux() *http.ServeMux {
	mux := http.NewServeMux()
	files, _ := fs.Sub(appFiles, "assets")
	mux.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.FS(files))))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		b, _ := appFiles.ReadFile("assets/index.html")
		_, _ = w.Write(b)
	})
	mux.HandleFunc("/api/styles", stylesLibraryHandler)
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `{"name":"CartoRig","version":%q,"offline":true}`, version)
	})
	mux.HandleFunc("/api/bundle", createBundle)
	mux.HandleFunc("/api/scene-bundle", createSceneBundle)
	mux.HandleFunc("/api/geo-packs", geoPacksHandler)
	mux.HandleFunc("/api/geo-packs/", geoPackGetHandler)
	mux.HandleFunc("/api/admin1/status", admin1StatusHandler)
	mux.HandleFunc("/api/admin1/data", admin1DataHandler)
	mux.HandleFunc("/api/admin1/install", admin1InstallHandler)
	mux.HandleFunc("/api/cities/status", cityStatusHandler)
	mux.HandleFunc("/api/cities/data", cityDataHandler)
	mux.HandleFunc("/api/cities/install", cityInstallHandler)
	mux.HandleFunc("/api/geodata/verify", geodataIntegrityHandler)
	mux.HandleFunc("/api/session", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			http.Error(w, "Method not allowed", 405)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"token":%q}`, sessionToken)
	})
	registerProduction(mux)
	return mux
}

func createBundle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", 405)
		return
	}
	// Limit total incoming PNG layer size, but allow 8K RGBA layers.
	r.Body = http.MaxBytesReader(w, r.Body, 320<<20)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "Invalid or oversized payload: "+err.Error(), 400)
		return
	}
	p := r.FormValue("project")
	var probe map[string]any
	if len(p) > 2<<20 || json.Unmarshal([]byte(p), &probe) != nil {
		http.Error(w, "Invalid project JSON", 400)
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="map-composer-fusion-layers.zip"`)
	w.Header().Set("Cache-Control", "no-store")
	zw := zip.NewWriter(w)
	defer zw.Close()
	write := func(name string, data []byte) {
		f, e := zw.Create(name)
		if e == nil {
			_, _ = f.Write(data)
		}
	}
	write("MapComposer/project.json", []byte(p))
	count := 0
	allowed := []string{"background", "grid", "borders", "highlights", "routes", "labels", "final"}
	for _, name := range allowed {
		f, header, err := r.FormFile(name)
		if err != nil {
			continue
		}
		if header.Size > 100<<20 {
			f.Close()
			continue
		}
		out, err := io.ReadAll(io.LimitReader(f, 100<<20))
		f.Close()
		if err != nil || len(out) < 8 || string(out[:4]) != "\x89PNG" {
			continue
		}
		write("MapComposer/layers/"+name+".png", out)
		count++
	}
	if count == 0 {
		write("MapComposer/EXPORT_ERROR.txt", []byte("No valid PNG layers were received."))
	}
	write("MapComposer/IMPORTAR_NO_DAVINCI.txt", []byte(`MAP COMPOSER - EXPORTACAO PARA DAVINCI RESOLVE STUDIO 20

1. Extraia este ZIP para uma pasta permanente do seu PC.
2. Abra o DaVinci Resolve e acesse a pagina Fusion.
3. Importe os PNGs da pasta "layers" com MediaIn/Loader ou arraste-os para o Media Pool.
4. Sobreponha os PNGs usando Merge, na ordem:
   background -> grid -> borders -> highlights -> routes -> labels
5. Cada camada tem a mesma resolucao e alinhamento. Mantenha o centro em 0.5/0.5 e a mesma duracao.
6. Anima as camadas independentemente no Fusion: zoom, pan, glow, rotas, textos.
7. Use final.png como referencia visual ou como imagem pronta.

Os PNGs preservam alpha nas camadas de sobreposicao.
A composicao automatica .setting ainda nao faz parte desta versao.

Geografia: Natural Earth 1:110m (177 feicoes de paises), generalizada.
A base nao foi desenvolvida para fronteiras municipais ou uso juridico.
`))
}

func launchBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		fmt.Println("Open manually:", url)
	}
}

// Security boundary: all mutations require a per-process nonce and local origin.
func secureLocal(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		if !strings.HasPrefix(host, "127.0.0.1:") && !strings.HasPrefix(host, "localhost:") {
			http.Error(w, "Invalid host", 403)
			return
		}
		if r.Method == http.MethodPost || r.Method == http.MethodDelete || (r.Method == http.MethodGet && (strings.HasPrefix(r.URL.Path, "/api/v2/project/") || strings.HasPrefix(r.URL.Path, "/api/v2/recovery") || strings.HasPrefix(r.URL.Path, "/api/v2/export/download/"))) {
			if r.Header.Get("X-CartoRig-Token") != sessionToken {
				http.Error(w, "Missing session token", 403)
				return
			}
			if origin := r.Header.Get("Origin"); origin != "" && origin != "http://"+host {
				http.Error(w, "Origin rejected", 403)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// The editor permits Unicode letters and digits in layer names (e.g. "Bolívar").
// Match the editor's filename normalization instead of rejecting valid accents.
// Path separators, control characters and all other punctuation remain forbidden.
var validLayerName = regexp.MustCompile(`^[\p{L}\p{N}_.-]{1,120}\.png$`)

func createSceneBundle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", 405)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 640<<20)
	if err := r.ParseMultipartForm(24 << 20); err != nil {
		http.Error(w, "Invalid or oversized export", 400)
		return
	}
	manifest := r.FormValue("manifest")
	project := r.FormValue("project")
	if len(manifest) > 1<<20 || len(project) > 8<<20 || !json.Valid([]byte(manifest)) || !json.Valid([]byte(project)) {
		http.Error(w, "Invalid manifest or project", 400)
		return
	}
	files := r.MultipartForm.File["layer"]
	if len(files) > 180 {
		http.Error(w, "Too many layers", 400)
		return
	}
	finalFiles := r.MultipartForm.File["final"]
	if len(finalFiles) != 1 {
		http.Error(w, "Missing final PNG", 400)
		return
	}
	// Validate all headers before streaming, so errors cannot produce truncated ZIP responses.
	for _, f := range append(files, finalFiles...) {
		if f.Size > 100<<20 || !validLayerName.MatchString(filepath.Base(f.Filename)) || f.Filename != filepath.Base(f.Filename) {
			http.Error(w, "Invalid layer file", 400)
			return
		}
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="CartoRig-Scene-Layers.zip"`)
	w.Header().Set("Cache-Control", "no-store")
	zipwriter := zip.NewWriter(w)
	defer zipwriter.Close()
	add := func(name string, data []byte) {
		f, err := zipwriter.Create(name)
		if err == nil {
			_, _ = f.Write(data)
		}
	}
	add("CartoRig/project.cartorig", []byte(project))
	add("CartoRig/manifest.json", []byte(manifest))
	for _, f := range append(files, finalFiles...) {
		reader, err := f.Open()
		if err != nil {
			continue
		}
		var sig [8]byte
		_, err = io.ReadFull(reader, sig[:])
		if err != nil || string(sig[:]) != "\x89PNG\r\n\x1a\n" {
			reader.Close()
			continue
		}
		_ = reader.Close()
		reader, err = f.Open()
		if err != nil {
			continue
		}
		folder := "layers/"
		if f == finalFiles[0] {
			folder = ""
		}
		dst, e := zipwriter.Create("CartoRig/" + folder + filepath.Base(f.Filename))
		if e == nil {
			_, _ = io.Copy(dst, io.LimitReader(reader, 100<<20))
		}
		reader.Close()
	}
	add("CartoRig/README.txt", []byte("CartoRig Scene Composer 1.1\nAll PNG layers share the same dimensions and map camera. Import PNGs to your video editor and overlay them without repositioning.\n"))
}
