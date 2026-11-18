//go:build !installer

package main

import (
    "encoding/json"
    "io"
    "log"
    "net/http"
    "sync/atomic"
    "time"
)
type previewDiagnostics struct {
    Phase string `json:"phase"`
    Renders uint64 `json:"renders"`
    Invalidations uint64 `json:"invalidations"`
    ResizeEvents uint64 `json:"resizeEvents"`
    SkippedHidden uint64 `json:"skippedHidden"`
    LastRenderMs float64 `json:"lastRenderMs"`
    MaxRenderMs float64 `json:"maxRenderMs"`
    FramePending bool `json:"framePending"`
    PreviewVisible bool `json:"previewVisible"`
    DocumentHidden bool `json:"documentHidden"`
    WebviewWidth float64 `json:"webviewWidth"`
    WebviewHeight float64 `json:"webviewHeight"`
    BaseRenders uint64 `json:"baseRenders"`
    BaseHits uint64 `json:"baseHits"`
    BaseDrawMs float64 `json:"baseDrawMs"`
    PreviewPixels uint64 `json:"previewPixels"`
    TextureCacheHits uint64 `json:"textureCacheHits"`
    TextureCacheMisses uint64 `json:"textureCacheMisses"`
    TextureCachePixels uint64 `json:"textureCachePixels"`
    TexturePrepareMs float64 `json:"texturePrepareMs"`
    TextureWorldMs float64 `json:"textureWorldMs"`
    TextureMaterialMs float64 `json:"textureMaterialMs"`
    TextureReliefMs float64 `json:"textureReliefMs"`
    TextureRasterCalls uint64 `json:"textureRasterCalls"`
    TexturePreparedCalls uint64 `json:"texturePreparedCalls"`
    TextureRasterCopies uint64 `json:"textureRasterCopies"`
    TextureCulledCopies uint64 `json:"textureCulledCopies"`
    StateDrawMs float64 `json:"stateDrawMs"`
    StateCacheHits uint64 `json:"stateCacheHits"`
    StateCacheMisses uint64 `json:"stateCacheMisses"`
    StateDrawnCopies uint64 `json:"stateDrawnCopies"`
    StateCulledCopies uint64 `json:"stateCulledCopies"`
}
var lastWebviewHeartbeat atomic.Int64
var nativeWindowVisible atomic.Bool
func desktopReceiveHeartbeat(w http.ResponseWriter,r *http.Request){
    if r.Method!=http.MethodPost{http.Error(w,"Method not allowed",http.StatusMethodNotAllowed);return}
    defer r.Body.Close()
    d:=json.NewDecoder(io.LimitReader(r.Body,4096))
    d.DisallowUnknownFields()
    var info previewDiagnostics
    if err:=d.Decode(&info);err!=nil{http.Error(w,"Invalid diagnostics",http.StatusBadRequest);return}
    if len(info.Phase)>24{http.Error(w,"Invalid phase",http.StatusBadRequest);return}
    lastWebviewHeartbeat.Store(time.Now().UnixNano())
    log.Printf("WEBVIEW_HEALTH phase=%q nativeVisible=%t docHidden=%t previewVisible=%t size=%.0fx%.0f renders=%d invalidations=%d resizes=%d skippedHidden=%d lastDrawMs=%.1f maxDrawMs=%.1f baseRenders=%d baseHits=%d baseDrawMs=%.1f previewPixels=%d texCacheHits=%d texCacheMisses=%d texCachePixels=%d texPrepareMs=%.1f texWorldMs=%.1f texMaterialsMs=%.1f texReliefMs=%.1f texRasterCalls=%d texPreparedCalls=%d texRasterCopies=%d texCulledCopies=%d stateDrawMs=%.1f stateCacheHits=%d stateCacheMisses=%d stateCopies=%d stateCulled=%d framePending=%t",
        info.Phase,nativeWindowVisible.Load(),info.DocumentHidden,info.PreviewVisible,
        info.WebviewWidth,info.WebviewHeight,info.Renders,info.Invalidations,
        info.ResizeEvents,info.SkippedHidden,info.LastRenderMs,info.MaxRenderMs,
        info.BaseRenders,info.BaseHits,info.BaseDrawMs,info.PreviewPixels,
        info.TextureCacheHits,info.TextureCacheMisses,info.TextureCachePixels,info.TexturePrepareMs,
        info.TextureWorldMs,info.TextureMaterialMs,info.TextureReliefMs,
        info.TextureRasterCalls,info.TexturePreparedCalls,info.TextureRasterCopies,info.TextureCulledCopies,
        info.StateDrawMs,info.StateCacheHits,info.StateCacheMisses,info.StateDrawnCopies,info.StateCulledCopies,
        info.FramePending)
    w.WriteHeader(http.StatusNoContent)
}
func monitorWebviewHealth(done <-chan struct{}){
    ticker:=time.NewTicker(10*time.Second)
    defer ticker.Stop()
    for {
        select{
        case <-done:return
        case <-ticker.C:
            if !nativeWindowVisible.Load(){continue}
            last:=lastWebviewHeartbeat.Load()
            if last==0 {log.Printf("WEBVIEW_WATCHDOG no heartbeat received since startup");continue}
            age:=time.Since(time.Unix(0,last))
            if age>=12*time.Second {
                log.Printf("WEBVIEW_WATCHDOG no JS heartbeat for %s while window should be visible",age.Round(time.Second))
            }
        }
    }
}
