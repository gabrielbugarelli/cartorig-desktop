//go:build wails && !installer

package main

import (
    "io/fs"
    "log"
    "time"
    "github.com/wailsapp/wails/v3/pkg/application"
)

// The asset server is in-process. There is no TCP localhost listener.
func main() {
    var app *application.App
    api := newMux()
    app = application.New(application.Options{
        Name: "CartoRig",
        Description: "Offline cartographic scene composer",
        Assets: application.AssetOptions{
            Handler: application.AssetFileServerFS(mustAssetsFS()),
            Middleware: desktopMiddleware(api, func() {
                time.Sleep(150 * time.Millisecond)
                app.Quit()
            }, func(name string) (string, error) {
                return app.Dialog.SaveFile().
                    SetFilename(name).
                    PromptForSingleSelection()
            }),
            DisableLogging: true,
        },
    })
    window := app.Window.NewWithOptions(application.WebviewWindowOptions{
        Name: "cartorig-main",
        Title: "CartoRig Desktop",
        Width: 1600, Height: 940,
        MinWidth: 800, MinHeight: 600,
        BackgroundColour: application.NewRGB(15,22,31),
    })
    window.Center()
    window.Show()
    if err := app.Run(); err != nil {
        log.Fatal(err)
    }
}

func mustAssetsFS() fs.FS {
    sub, err := fs.Sub(appFiles, "assets")
    if err != nil { panic(err) }
    return sub
}
