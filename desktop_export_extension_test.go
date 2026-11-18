//go:build !installer

package main

import (
    "io"
    "net/http"
    "net/http/httptest"
    "os"
    "path/filepath"
    "strings"
    "testing"
)

func TestDesktopExportPathKeepsRequestedExtension(t *testing.T) {
    cases := []struct{ suggested, selected, want string }{
        {"Mapa_Brasil_Russia.png", "Mapa_Brasil_Russia_Teste", "Mapa_Brasil_Russia_Teste.png"},
        {"Mapa_Brasil_Russia_Layers.zip", "Mapa_Brasil_Russia_Layers_Teste", "Mapa_Brasil_Russia_Layers_Teste.zip"},
        {"Mapa_Brasil_Russia_Production.zip", "Mapa_Brasil_Russia_Production_Teste", "Mapa_Brasil_Russia_Production_Teste.zip"},
        {"Mapa_Brasil_Russia.svg", "Mapa_Brasil_Russia_Teste", "Mapa_Brasil_Russia_Teste.svg"},
        {"Mapa_Brasil_Russia.cartorig", "Mapa_Brasil_Russia_Teste", "Mapa_Brasil_Russia_Teste.cartorig"},
        {"Scene.png", "Renamed.png", "Renamed.png"},
        {"Scene.png", "Renamed.PNG", "Renamed.PNG"},
        {"Scene.zip", "Renamed.with.dots", "Renamed.with.dots.zip"},
        {"Scene.png", "Renamed.", "Renamed.png"},
        {"Scene.png", "", ""},
    }
    for _, c := range cases {
        t.Run(c.suggested+"/"+c.selected,func(t *testing.T) {
            got:=desktopExportPath(c.selected,c.suggested)
            if got!=c.want { t.Fatalf("desktopExportPath(%q,%q)=%q, want %q",c.selected,c.suggested,got,c.want) }
        })
    }
}

func TestDesktopSaveRenamedExportFormats(t *testing.T) {
    for _, tc := range []struct{suffix, suggested string}{
        {".png","Mapa_Brasil_Russia.png"},
        {".zip","Mapa_Brasil_Russia_Layers.zip"},
        {".svg","Mapa_Brasil_Russia.svg"},
        {".cartorig","Mapa_Brasil_Russia.cartorig"},
    } {
        t.Run(tc.suffix,func(t *testing.T){
            dir:=t.TempDir()
            output:=filepath.Join(dir,"Mapa_Brasil_Russia_Teste")
            payload:="test-export-payload"+tc.suffix
            picker:=func(suggested string)(string,error){
                if suggested!=tc.suggested {t.Errorf("picker suggested %q, expected %q",suggested,tc.suggested)}
                return output,nil
            }
            req:=httptest.NewRequest(http.MethodPost,"/api/desktop/save?name="+tc.suggested,strings.NewReader(payload))
            recorder:=httptest.NewRecorder()
            desktopSave(recorder,req,picker)
            if recorder.Code!=http.StatusOK { t.Fatalf("HTTP status %d: %s",recorder.Code,recorder.Body.String()) }
            actual,err:=os.ReadFile(output+tc.suffix)
            if err!=nil {t.Fatal(err)}
            if string(actual)!=payload {t.Fatalf("payload changed: %q",actual)}
            if _,err=os.Stat(output);!os.IsNotExist(err){t.Fatalf("export with no suffix exists (err=%v)",err)}
        })
    }
}

func TestDesktopSaveCancelDoesNotCreateFile(t *testing.T) {
    dest:=filepath.Join(t.TempDir(),"Cancelled")
    req:=httptest.NewRequest(http.MethodPost,"/api/desktop/save?name=Cancelled.zip",strings.NewReader("unused"))
    recorder:=httptest.NewRecorder()
    desktopSave(recorder,req,func(suggested string)(string,error){return "",nil})
    if recorder.Code!=http.StatusNoContent {t.Fatalf("cancel status %d",recorder.Code)}
    if f,err:=os.Open(dest+".zip");err==nil {f.Close();t.Fatal("cancel wrote a file")}else if err!=nil && !os.IsNotExist(err) {t.Fatal(err)}
}

// File downloads are binary: the HTTP endpoint must not rewrite their content.
func TestDesktopSaveDoesNotChangePayload(t *testing.T) {
    dir:=t.TempDir()
    data:=[]byte{0,1,2,80,75,3,255}
    req:=httptest.NewRequest(http.MethodPost,"/api/desktop/save?name=Bundle.zip",io.NopCloser(strings.NewReader(string(data))))
    recorder:=httptest.NewRecorder()
    desktopSave(recorder,req,func(s string)(string,error){return filepath.Join(dir,"Bundle_new"),nil})
    if recorder.Code!=http.StatusOK {t.Fatalf("status %d",recorder.Code)}
    got,err:=os.ReadFile(filepath.Join(dir,"Bundle_new.zip"))
    if err!=nil {t.Fatal(err)}
    if string(got)!=string(data){t.Fatal("export bytes modified")}
}
