//go:build !wails && !installer

package main

// Original browser entrypoint, still available for backend regression tests.
func main() { runLegacyBrowser() }
