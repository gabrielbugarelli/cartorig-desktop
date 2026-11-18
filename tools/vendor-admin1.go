//go:build ignore

// Run: go run tools/vendor-admin1.go
// Vendors Natural Earth 1:10m world Admin 1 into the Go embed.FS package before building.
// An app built after this step works entirely offline from its first launch.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

func main() {
	const url = "https://raw.githubusercontent.com/datasets/geo-ne-admin1/main/data/admin1.geojson"
	const destination = "assets/geodata/admin1_world.geojson"
	client := &http.Client{Timeout: 4 * time.Minute}
	response, err := client.Get(url)
	if err != nil {
		panic("could not acquire Natural Earth global data: " + err.Error())
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		panic(fmt.Sprintf("geo data HTTP %d", response.StatusCode))
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 125<<20))
	if err != nil {
		panic(err)
	}
	var d struct {
		Type     string `json:"type"`
		Features []struct {
			Properties struct {
				Admin string `json:"admin"`
				Name  string `json:"name"`
			} `json:"properties"`
		} `json:"features"`
	}
	if err = json.Unmarshal(data, &d); err != nil {
		panic(err)
	}
	countries := map[string]bool{}
	found := map[string]bool{}
	for _, f := range d.Features {
		countries[f.Properties.Admin] = true
		if f.Properties.Admin == "Canada" && f.Properties.Name == "Ontario" {
			found["Ontario"] = true
		}
		if f.Properties.Admin == "United States of America" && f.Properties.Name == "California" {
			found["California"] = true
		}
	}
	if d.Type != "FeatureCollection" || len(d.Features) < 3000 || len(countries) < 70 || !found["Ontario"] || !found["California"] {
		panic("data source lacks complete worldwide Admin1 polygon coverage")
	}
	if err = os.MkdirAll(filepath.Dir(destination), 0755); err != nil {
		panic(err)
	}
	if err = os.WriteFile(destination, data, 0644); err != nil {
		panic(err)
	}
	fmt.Printf("Bundled %d real administrative polygons into %s (%d bytes)\n", len(d.Features), destination, len(data))
}
