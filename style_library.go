//go:build !installer

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

// Style library is a local user configuration file, never transmitted to a service.
// The session token/Origin checks are enforced by secureLocal for all writes.
var styleLibraryMu sync.Mutex
var styleColor = regexp.MustCompile(`^#(?:[A-Fa-f0-9]{3,4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$`)

type styleAssetReference struct {
	AssetID      string `json:"asset_id"`
	RelativePath string `json:"relative_path"`
	SHA256       string `json:"sha256"`
	MIMEType     string `json:"mime_type"`
}

type localStyle struct {
	Format        string                    `json:"format"`
	SchemaVersion string                    `json:"schema_version"`
	ID            string                    `json:"id"`
	Name          string                    `json:"name"`
	Description   string                    `json:"description,omitempty"`
	Palette       map[string]string         `json:"palette"`
	Defaults      map[string]map[string]any `json:"defaults"`
	Overrides     map[string]any            `json:"overrides,omitempty"`
	Metadata      map[string]string         `json:"metadata,omitempty"`
	AssetRefs     []styleAssetReference     `json:"asset_refs,omitempty"`
}

func styleLibraryPath() (string, error) {
	config, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(config, "CartoRig", "style-library.json"), nil
}
func validateStyleLibrary(data []byte) error {
	if len(data) > 2*1024*1024 {
		return errors.New("library exceeds 2 MB")
	}
	var styles []localStyle
	if err := json.Unmarshal(data, &styles); err != nil {
		return err
	}
	if styles == nil || len(styles) > 100 {
		return errors.New("invalid number of styles")
	}
	seen := map[string]bool{}
	allowedTextures := map[string]bool{"": true, "shadedrelief": true, "bmng": true, "etopo1": true}
	allowedColors := map[string]bool{"ocean": true, "land": true, "border": true, "grid": true, "text": true, "accent": true}
	allowedMetadata := map[string]bool{"origin": true, "source_theme": true, "created_at": true, "updated_at": true, "author": true, "license": true, "source_version": true}
	assetPath := regexp.MustCompile(`^assets/[A-Za-z0-9_-]+\.(?:svg|png|jpg|woff2)$`)
	hashPattern := regexp.MustCompile(`^[a-fA-F0-9]{64}$`)
	assetUUID := regexp.MustCompile(`^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$`)
	for _, s := range styles {
		if s.Format != "cartorig-style" || s.SchemaVersion != "1.0.0" || len(s.ID) > 100 || len(s.ID) < 5 || len(s.Name) > 90 || len(s.Name) == 0 || len(s.Description) > 400 || seen[s.ID] {
			return errors.New("invalid style metadata")
		}
		seen[s.ID] = true
		if len(s.Palette) == 0 || len(s.Palette) > 16 || len(s.Defaults) > 10 || len(s.Overrides) > 50 || len(s.Metadata) > 8 || len(s.AssetRefs) > 20 {
			return errors.New("invalid style fields")
		}
		for key, val := range s.Palette {
			if key == "texture" {
				if !allowedTextures[val] {
					return fmt.Errorf("invalid texture %q", val)
				}
				continue
			}
			if !allowedColors[key] || !styleColor.MatchString(val) {
				return fmt.Errorf("invalid palette entry %q", key)
			}
		}
		for key, value := range s.Metadata {
			if !allowedMetadata[key] || len(value) > 128 || strings.ContainsAny(value, "<>\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0e\x0f") {
				return errors.New("invalid style metadata")
			}
		}
		for _, asset := range s.AssetRefs {
			if !assetUUID.MatchString(asset.AssetID) || !assetPath.MatchString(asset.RelativePath) || !hashPattern.MatchString(asset.SHA256) || !map[string]bool{"image/svg+xml": true, "image/png": true, "image/jpeg": true, "font/woff2": true}[asset.MIMEType] {
				return errors.New("invalid style asset reference")
			}
		}
		for _, fields := range s.Defaults {
			if len(fields) > 50 {
				return errors.New("too many default fields")
			}
		}
	}
	return nil
}
func stylesLibraryHandler(w http.ResponseWriter, r *http.Request) {
	styleLibraryMu.Lock()
	defer styleLibraryMu.Unlock()
	path, err := styleLibraryPath()
	if err != nil {
		http.Error(w, "Cannot resolve user config", 500)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	switch r.Method {
	case http.MethodGet:
		data, err := os.ReadFile(path)
		if errors.Is(err, os.ErrNotExist) {
			_, _ = w.Write([]byte("[]"))
			return
		}
		if err != nil || validateStyleLibrary(data) != nil {
			http.Error(w, "Local style library invalid", 500)
			return
		}
		_, _ = w.Write(data)
	case http.MethodPost:
		r.Body = http.MaxBytesReader(w, r.Body, 2*1024*1024)
		data, err := io.ReadAll(r.Body)
		if err != nil || validateStyleLibrary(data) != nil {
			http.Error(w, "Invalid styles payload", 400)
			return
		}
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			http.Error(w, "Cannot create config", 500)
			return
		}
		tmp, err := os.CreateTemp(filepath.Dir(path), ".styles-*.tmp")
		if err != nil {
			http.Error(w, "Cannot stage styles", 500)
			return
		}
		name := tmp.Name()
		defer os.Remove(name)
		if _, err = tmp.Write(data); err == nil {
			err = tmp.Sync()
		}
		if err1 := tmp.Close(); err == nil {
			err = err1
		}
		if err == nil {
			err = os.Rename(name, path)
		}
		if err != nil {
			http.Error(w, "Cannot save styles", 500)
			return
		}
		_, _ = w.Write([]byte(`{"ok":true}`))
	default:
		http.Error(w, "Method not allowed", 405)
	}
}
