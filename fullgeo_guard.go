//go:build fullgeo && !installer

package main

import (
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"fmt"
)

// A fullgeo build is impossible when ANY of these three generated assets is
// missing. The Go executable embeds the complete original Natural Earth data.
//
//go:embed assets/geodata/admin1_world.geojson
var sealedAdmin1 []byte

//go:embed assets/geodata/cities_world_full.geojson
var sealedCities []byte

//go:embed assets/geodata/offline_integrity.json
var sealedManifest []byte

func init() {
	for _, pair := range []struct {
		name string
		raw  []byte
	}{{"admin1", sealedAdmin1}, {"cities", sealedCities}} {
		r, err := manifestRecord(pair.name, sealedManifest)
		if err != nil {
			panic("CartoRig fullgeo manifest: " + err.Error())
		}
		n, hash, err := validateAndHash(pair.name, pair.raw)
		if err != nil {
			panic(fmt.Sprintf("CartoRig dataset %s malformed: %v", pair.name, err))
		}
		if hash != r.SHA256 || n != r.FeatureCount || r.Scale != "10m" {
			panic(fmt.Sprintf("CartoRig dataset %s fingerprint/count mismatch: %s, %d", pair.name, hash, n))
		}
		if r.Bytes != len(pair.raw) {
			panic(fmt.Sprintf("CartoRig dataset %s byte length mismatch", pair.name))
		}
		// GitHub blob ID is pinned by prepare_offline_datasets.py, not recomputed in Go.
		check := sha256.Sum256(pair.raw)
		if hex.EncodeToString(check[:]) != r.SHA256 {
			panic("CartoRig internal hash mismatch")
		}
		offlineReleaseRecords[pair.name] = r
	}
	offlineReleaseVerified = true
}
