//go:build !installer

package main

import (
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
)
func TestDesktopHeartbeat(t *testing.T){
    good := `{"phase":"periodic","renders":4,"invalidations":13,"resizeEvents":2,"skippedHidden":3,"lastRenderMs":15.5,"maxRenderMs":18.7,"framePending":false,"previewVisible":true,"documentHidden":false,"webviewWidth":1180,"webviewHeight":720}`
    nativeWindowVisible.Store(true)
    w:=httptest.NewRecorder()
    desktopReceiveHeartbeat(w,httptest.NewRequest(http.MethodPost,"http://wails.localhost/api/desktop/heartbeat",strings.NewReader(good)))
    if w.Code!=http.StatusNoContent{t.Fatalf("heartbeat code=%d: %s",w.Code,w.Body.String())}
    if lastWebviewHeartbeat.Load()==0{t.Fatal("heartbeat timestamp not recorded")}
    for _,body:=range []string{`{"phase":"nope","objects":{"secret":1}}`,`malformed`}{
        w=httptest.NewRecorder()
        desktopReceiveHeartbeat(w,httptest.NewRequest(http.MethodPost,"http://wails.localhost/api/desktop/heartbeat",strings.NewReader(body)))
        if w.Code!=http.StatusBadRequest {t.Fatalf("unexpected request accepted: %d",w.Code)}
    }
}
