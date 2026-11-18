//go:build wails && windows && !installer

package main

import (
    "fmt"
    "log"
    "os"
    "path/filepath"
    "strings"
    "syscall"
    "unsafe"
)

var desktopLogFile *os.File
var desktopStartupLogPath string

func toString(v any) string { return fmt.Sprint(v) }

func initDesktopLogging() {
    dir, err := os.UserCacheDir()
    if err != nil || dir == "" { dir = os.TempDir() }
    dir = filepath.Join(dir, "CartoRig", "logs")
    if err := os.MkdirAll(dir, 0700); err != nil {
        dir = os.TempDir()
    }
    desktopStartupLogPath = filepath.Join(dir,"desktop-startup.log")
    file, err := os.OpenFile(desktopStartupLogPath,os.O_CREATE|os.O_WRONLY|os.O_APPEND,0600)
    if err == nil {
        desktopLogFile = file
        log.SetOutput(file)
    }
    log.SetFlags(log.LstdFlags | log.Lmicroseconds | log.Lshortfile)
}

func syncDesktopLog() {
    if desktopLogFile != nil { _ = desktopLogFile.Sync() }
}

func desktopStartupFailure(err error) {
    log.Printf("FATAL: %v", err)
    syncDesktopLog()
    msg := "CartoRig Desktop nao conseguiu iniciar.\n\n" +
           err.Error() + "\n\nLog: " + desktopStartupLogPath +
           "\n\nEnvie o log para diagnostico."
    if os.Getenv("CARTORIG_NO_GUI_ERRORS") == "1" { return }
    title,_ := syscall.UTF16PtrFromString("CartoRig Desktop - Erro de inicializacao")
    body,_ := syscall.UTF16PtrFromString(msg)
    proc := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW")
    _, _, _ = proc.Call(0,uintptr(unsafe.Pointer(body)),uintptr(unsafe.Pointer(title)),0x10)
}

// This is a diagnostic-only launch. It does not start the GUI and can be
// invoked from PowerShell to capture the system runtime version in the log.
func desktopSelfCheck() {
    initDesktopLogging()
    log.Printf("Self-check: path=%s",desktopStartupLogPath)
    log.Printf("Self-check: OS=%s",os.Getenv("OS"))
    log.Printf("Self-check: LOCALAPPDATA=%s",os.Getenv("LOCALAPPDATA"))
    syncDesktopLog()
}

func hasDiagnosticArg() bool {
    for _, arg := range os.Args[1:] {
        if strings.EqualFold(arg,"--self-check") { return true }
    }
    return false
}
