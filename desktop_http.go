//go:build !installer

package main

import (
    "errors"
    "fmt"
    "io"
    "net/http"
    "os"
    "path/filepath"
    "regexp"
    "strings"
)

// The Wails WebView uses a virtual origin without a TCP listener.
const desktopOrigin = "http://wails.localhost"

var desktopSafeName = regexp.MustCompile("[^\\p{L}\\p{N}._() -]+")

func desktopFilename(input string) string {
    input = strings.TrimSpace(strings.ReplaceAll(input, "\\", "/"))
    input = filepath.Base(input)
    input = desktopSafeName.ReplaceAllString(input, "_")
    input = strings.Trim(input, " .")
    if len(input) > 120 { input = input[:120] }
    if input == "" || input == "." || input == ".." { input = "CartoRig-Export.zip" }
    return input
}

func desktopNeedsToken(r *http.Request) bool {
    return r.Method == http.MethodPost || r.Method == http.MethodDelete ||
        (r.Method == http.MethodGet && (strings.HasPrefix(r.URL.Path, "/api/v2/project/") ||
            strings.HasPrefix(r.URL.Path, "/api/v2/recovery") ||
            strings.HasPrefix(r.URL.Path, "/api/v2/export/download/")))
}

func desktopValidHost(host string) bool {
    return host == "wails.localhost" || host == "wails"
}
func desktopValidOrigin(origin string) bool {
    switch strings.TrimSuffix(origin, "/") {
    case "", desktopOrigin, "https://wails.localhost", "wails://wails":
        return true
    default:
        return false
    }
}

type desktopSaveDialog func(suggestedFilename string) (string, error)

func desktopMiddleware(api http.Handler, nativeQuit func(), nativeSave desktopSaveDialog) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request) {
            path:=r.URL.Path
            if !strings.HasPrefix(path, "/api/") && !strings.HasPrefix(path, "/assets/") && path != "/" {
                next.ServeHTTP(w,r)
                return
            }
            if !desktopValidHost(r.Host) || !desktopValidOrigin(r.Header.Get("Origin")) {
                http.Error(w,"Desktop origin rejected",http.StatusForbidden)
                return
            }
            if strings.HasPrefix(path,"/api/") && desktopNeedsToken(r) && r.Header.Get("X-CartoRig-Token")!=sessionToken {
                http.Error(w,"Missing session token",http.StatusForbidden)
                return
            }
            if path=="/api/quit" {
                http.Error(w,"Exit through the Windows notification area",http.StatusGone)
                return
            }
            if path=="/api/desktop/heartbeat" {
                desktopReceiveHeartbeat(w,r)
                return
            }
            if path=="/api/desktop/save" {
                desktopSave(w,r,nativeSave)
                return
            }
            api.ServeHTTP(w,r)
        })
    }
}

func desktopSave(w http.ResponseWriter,r *http.Request,picker desktopSaveDialog) {
    if r.Method!=http.MethodPost { http.Error(w,"Method not allowed",405);return }
    if picker==nil {http.Error(w,"Desktop save dialog unavailable",503);return}
    suggested:=desktopFilename(r.URL.Query().Get("name"))
    path,err:=picker(suggested)
    if errors.Is(err,os.ErrNotExist) || path=="" {
        w.WriteHeader(http.StatusNoContent);return
    }
    if err!=nil {http.Error(w,"Unable to choose a file destination: "+err.Error(),500);return}
    if info,err:=os.Stat(path);err==nil && info.IsDir() {http.Error(w,"Invalid file destination",400);return}
    file,err:=os.CreateTemp(filepath.Dir(path),".cartorig-export-*")
    if err!=nil {http.Error(w,"Unable to create export file: "+err.Error(),500);return}
    tmp:=file.Name()
    defer os.Remove(tmp)
    bytesWritten,copyErr:=io.Copy(file,io.LimitReader(r.Body,(1536<<20)+1))
    closeErr:=file.Close()
    if copyErr!=nil || closeErr!=nil || bytesWritten>1536<<20 {
        http.Error(w,"Export could not be written or exceeded the size limit",413);return
    }
    if err=os.Rename(tmp,path);err!=nil {
        if _,statErr:=os.Stat(path);statErr==nil {
            backup,backupErr:=os.CreateTemp(filepath.Dir(path),".cartorig-backup-*")
            if backupErr==nil {
                backupName:=backup.Name()
                _=backup.Close()
                _=os.Remove(backupName)
                if backupErr=os.Rename(path,backupName);backupErr==nil {
                    if err=os.Rename(tmp,path);err!=nil {
                        _=os.Rename(backupName,path)
                    } else {
                        _=os.Remove(backupName)
                    }
                }
            }
        }
    }
    if err!=nil {http.Error(w,fmt.Sprintf("Could not finish export: %v",err),500);return}
    w.Header().Set("Content-Type","application/json")
    _,_=w.Write([]byte("{\"ok\":true}"))
}
