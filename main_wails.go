//go:build wails && !installer

package main

import (
    "errors"
    "io/fs"
    "log"
    "runtime/debug"
    "strings"
    "time"

    "github.com/wailsapp/wails/v3/pkg/application"
)

// Windows desktop startup is logged even when compiled as windowsgui.
// Wails uses the in-process asset server; no localhost TCP port is opened.
func main() {
    if hasDiagnosticArg() { desktopSelfCheck(); return }
    initDesktopLogging()
    log.Printf("CartoRig Wails 3 startup")
    defer func() {
        if value := recover(); value != nil {
            desktopStartupFailure(errors.New("panic during startup: " + toString(value) +
                "\n" + string(debug.Stack())))
        }
    }()

    var app *application.App
    api := newMux()
    log.Printf("CartoRig API registered")
    app = application.New(application.Options{
        Name: "CartoRig",
        Description: "Offline cartographic scene composer",
        ErrorHandler: func(err error) {
            if err != nil {
                log.Printf("Wails internal error: %v", err)
                syncDesktopLog()
            }
        },
        PanicHandler: func(details *application.PanicDetails) {
            log.Printf("Wails panic: %+v", details)
            syncDesktopLog()
        },
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
    log.Printf("Wails application initialized")
    // Windows WebView2 is a separate runtime; absence may cause a silent
    // immediate exit in a GUI-subsystem executable.
    platform := app.Env.Info().PlatformInfo
    if value, present := platform["WebView2"]; present {
        version, ok := value.(string)
        if ok && strings.TrimSpace(version) == "" {
            desktopStartupFailure(errors.New(
                "Microsoft Edge WebView2 Runtime is missing or broken. " +
                "Install or repair it from https://developer.microsoft.com/microsoft-edge/webview2/"))
            return
        }
        log.Printf("WebView2 runtime: %v", value)
    }

    window := app.Window.NewWithOptions(application.WebviewWindowOptions{
        Name: "cartorig-main",
        Title: "CartoRig Desktop",
        Width: 1600, Height: 940,
        MinWidth: 800, MinHeight: 600,
        BackgroundColour: application.NewRGB(15,22,31),
    })
    log.Printf("Window registered")
    window.Center()
    window.Show()
    log.Printf("Entering Wails event loop")
    if err := app.Run(); err != nil {
        desktopStartupFailure(err)
        return
    }
    log.Printf("Wails event loop finished normally")
}

func mustAssetsFS() fs.FS {
    sub, err := fs.Sub(appFiles, "assets")
    if err != nil { panic(err) }
    return sub
}
