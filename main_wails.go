//go:build wails && !installer

package main

import (
    _ "embed"
    "errors"
    "io/fs"
    "log"
    "runtime/debug"
    "strings"
    "sync/atomic"

    "github.com/wailsapp/wails/v3/pkg/application"
    "github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed assets/cartorig-brand.png
var cartorigIcon []byte

func main() {
    if hasDiagnosticArg(){desktopSelfCheck();return}
    initDesktopLogging()
    log.Printf("CartoRig Wails 3 startup")
    defer func(){
        if value:=recover();value!=nil {
            desktopStartupFailure(errors.New("panic during startup: "+toString(value)+"\n"+string(debug.Stack())))
        }
    }()

    var app *application.App
    var window *application.WebviewWindow
    var shuttingDown atomic.Bool
    // Deliver native visibility to the Canvas scheduler; no document reload.
    // Wails may keep document.hidden false while the HWND is hidden.
    sendVisibility:=func(visible bool){
        if window==nil{return}
        if visible{
            window.ExecJS("window.dispatchEvent(new CustomEvent('cartorig-desktop-visibility',{detail:{visible:true}}))")
        }else{
            window.ExecJS("window.dispatchEvent(new CustomEvent('cartorig-desktop-visibility',{detail:{visible:false}}))")
        }
    }
    restoreWindow:=func(){
        if window==nil{return}
        log.Printf("TRAY_RESTORE begin")
        window.Show()
        nativeWindowVisible.Store(true)
        log.Printf("TRAY_RESTORE window shown; sending visible signal")
        sendVisibility(true)
        log.Printf("TRAY_RESTORE signal delivered; focusing")
        window.Focus()
        log.Printf("TRAY_RESTORE complete")
    }
    api:=newMux()
    log.Printf("CartoRig API registered")
    app=application.New(application.Options{
        Name:"CartoRig",
        Description:"Offline cartographic scene composer",
        Icon:cartorigIcon,
        SingleInstance:&application.SingleInstanceOptions{
            UniqueID:"com.cartorig.desktop",
            OnSecondInstanceLaunch:func(_ application.SecondInstanceData){
                log.Printf("Second instance: restoring CartoRig window")
                application.InvokeSync(restoreWindow)
            },
        },
        ErrorHandler:func(err error){if err!=nil{log.Printf("Wails internal error: %v",err);syncDesktopLog()}},
        PanicHandler:func(details *application.PanicDetails){log.Printf("Wails panic: %+v",details);syncDesktopLog()},
        Assets:application.AssetOptions{
            Handler:application.AssetFileServerFS(mustAssetsFS()),
            Middleware:desktopMiddleware(api,nil,func(name string)(string,error){
                return app.Dialog.SaveFile().SetFilename(name).PromptForSingleSelection()
            }),
            DisableLogging:true,
        },
    })
    log.Printf("Wails application initialized")
    platform:=app.Env.Info().PlatformInfo
    if value,present:=platform["WebView2"];present{
        if version,ok:=value.(string);ok&&strings.TrimSpace(version)==""{
            desktopStartupFailure(errors.New("Microsoft Edge WebView2 Runtime is missing or broken. Install or repair it from https://developer.microsoft.com/microsoft-edge/webview2/"))
            return
        }
        log.Printf("WebView2 runtime: %v",value)
    }

    window=app.Window.NewWithOptions(application.WebviewWindowOptions{
        Name:"cartorig-main",Title:"CartoRig Desktop",
        Width:1600,Height:940,MinWidth:800,MinHeight:600,
        BackgroundColour:application.NewRGB(15,22,31),
    })
    window.RegisterHook(events.Common.WindowClosing,func(e *application.WindowEvent){
        if shuttingDown.Load(){return}
        e.Cancel()
        log.Printf("WINDOW_CLOSE begin: send visibility false")
        sendVisibility(false)
        log.Printf("WINDOW_CLOSE signal sent; hide window")
        window.Hide()
        nativeWindowVisible.Store(false)
        log.Printf("WINDOW_CLOSE complete: hidden to notification area")
    })

    // No AttachWindow: it overrides left-click with show/hide instead of menu.
    tray:=app.SystemTray.New()
    tray.SetIcon(cartorigIcon)
    tray.SetLabel("CartoRig")
    menu:=app.NewMenu()
    menu.Add("Abrir CartoRig").OnClick(func(_ *application.Context){restoreWindow()})
    menu.AddSeparator()
    menu.Add("Fechar CartoRig").OnClick(func(_ *application.Context){
        shuttingDown.Store(true)
        log.Printf("User exited CartoRig through Windows notification area")
        syncDesktopLog()
        app.Quit()
    })
    tray.SetMenu(menu)
    tray.OnClick(func(){tray.ShowMenu()})
    log.Printf("Tray registered; left click opens menu")
    window.Center()
    window.Show()
    nativeWindowVisible.Store(true)
    doneMonitoring:=make(chan struct{})
    go monitorWebviewHealth(doneMonitoring)
    defer close(doneMonitoring)
    log.Printf("Entering Wails event loop")
    if err:=app.Run();err!=nil{desktopStartupFailure(err);return}
    log.Printf("Wails event loop finished normally")
}

func mustAssetsFS() fs.FS {
    sub,err:=fs.Sub(appFiles,"assets")
    if err!=nil{panic(err)}
    return sub
}
