//go:build ignore

// Run: go run tools/vendor-cities.go
// Download the complete real Natural Earth 10m populated places GeoJSON before
// building an installer that works offline on its first execution.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func main() {
	const source = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson"
	const target = "assets/geodata/cities_world_full.geojson"
	response, err := (&http.Client{Timeout: 4 * time.Minute}).Get(source)
	if err != nil {
		panic("could not obtain Natural Earth cities: " + err.Error())
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		panic(fmt.Sprintf("cities source returned %d", response.StatusCode))
	}
	b, err := io.ReadAll(io.LimitReader(response.Body, 80<<20))
	if err != nil {
		panic(err)
	}
	var data struct {
		Type     string `json:"type"`
		Features []struct {
			Properties struct {
				Name  string `json:"name"`
				Admin string `json:"adm0name"`
			} `json:"properties"`
			Geometry struct {
				Type        string    `json:"type"`
				Coordinates []float64 `json:"coordinates"`
			} `json:"geometry"`
		} `json:"features"`
	}
	if err = json.Unmarshal(b, &data); err != nil {
		panic(err)
	}
	if data.Type != "FeatureCollection" || len(data.Features) < 500 || len(data.Features) > 20000 {
		panic("city dataset has incorrect shape or size")
	}
	countries := make(map[string]bool)
	munich := false
	for _, f := range data.Features {
		if f.Geometry.Type != "Point" || len(f.Geometry.Coordinates) != 2 {
			panic("invalid city coordinate")
		}
		countries[f.Properties.Admin] = true
		if strings.EqualFold(f.Properties.Name, "Munich") || strings.EqualFold(f.Properties.Name, "München") {
			munich = true
		}
	}
	if len(countries) < 75 || !munich {
		panic("city dataset lacks Munich or sufficient global coverage")
	}
	if err = os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		panic(err)
	}
	f, err := os.CreateTemp(filepath.Dir(target), ".cities-*.tmp")
	if err != nil {
		panic(err)
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(b); err != nil {
		f.Close()
		panic(err)
	}
	if err = f.Close(); err != nil {
		panic(err)
	}
	if err = os.Rename(f.Name(), target); err != nil {
		panic(err)
	}
	fmt.Printf("Bundled %d Natural Earth world city points into %s (%d bytes)\n", len(data.Features), target, len(b))
}
