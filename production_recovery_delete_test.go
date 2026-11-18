//go:build !installer

package main

import (
 "encoding/json"
 "net/http"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

const recoveryID2="ca252a84-22ad-49ba-9f18-c30000000002"
const recoveryID3="ca252a84-22ad-49ba-9f18-c30000000003"

func recoveryFixture(t *testing.T, id string, revision int) []byte {
 t.Helper()
 var p map[string]any
 if err:=json.Unmarshal(productionProject(revision),&p);err!=nil {t.Fatal(err)}
 p["project_id"]=id
 p["name"]="Recovery test "+id
 data,err:=json.Marshal(p)
 if err!=nil {t.Fatal(err)}
 return data
}
func recoveryRequest(t *testing.T,mux *http.ServeMux,ids ...string)*testRecoveryResult {
 t.Helper()
 data,err:=json.Marshal(map[string]any{"ids":ids})
 if err!=nil {t.Fatal(err)}
 rr:=requestProduction(t,mux,http.MethodDelete,"/api/v2/recovery",data,true)
 result:=&testRecoveryResult{Code:rr.Code,Body:rr.Body.String()}
 if rr.Code==200 {
  if err=json.Unmarshal(rr.Body.Bytes(),&result.Counts);err!=nil {t.Fatal(err)}
 }
 return result
}
type testRecoveryResult struct{
 Code int
 Body string
 Counts struct{Deleted int `json:"deleted"`;Missing int `json:"missing"`}
}
func TestRecoveryDeleteSingleMultipleAndAll(t *testing.T) {
 t.Setenv("CARTORIG_DATA_DIR",t.TempDir())
 mux:=newMux()
 ids:=[]string{testProjectID,recoveryID2,recoveryID3}
 // A saved project and an unrelated template must not be removed.
 saved:=requestProduction(t,mux,"POST","/api/v2/project/save",recoveryFixture(t,ids[0],1),true)
 if saved.Code!=200 {t.Fatalf("save %d %s",saved.Code,saved.Body.String())}
 tmpl,err:=productionPath("Templates","keep.txt")
 if err!=nil {t.Fatal(err)}
 if err=os.MkdirAll(filepath.Dir(tmpl),0700);err!=nil {t.Fatal(err)}
 if err=os.WriteFile(tmpl,[]byte("keep"),0600);err!=nil {t.Fatal(err)}
 for _,id:=range ids {
  for revision:=2;revision<=3;revision++ {
   rr:=requestProduction(t,mux,"POST","/api/v2/autosave",recoveryFixture(t,id,revision),true)
   if rr.Code!=200 {t.Fatalf("autosave %s rev=%d: %s",id,revision,rr.Body.String())}
  }
 }
 root,err:=productionPath("Autosaves")
 if err!=nil {t.Fatal(err)}
 for _,id:=range ids {
  if _,err=os.Stat(filepath.Join(root,id,"latest.json.bak"));err!=nil {t.Fatalf("expected backup %s: %v",id,err)}
 }
 // Reject invalid batch atomically, before deleting any valid ID.
 invalid:=recoveryRequest(t,mux,testProjectID,"../../Projects")
 if invalid.Code!=400 {t.Fatalf("traversal accepted: %d %s",invalid.Code,invalid.Body)}
 if _,err=os.Stat(filepath.Join(root,testProjectID,"latest.json"));err!=nil {t.Fatal(err)}
 noToken:=requestProduction(t,mux,"DELETE","/api/v2/recovery",[]byte(`{"ids":["`+ids[0]+`"]}`),false)
 if noToken.Code!=403 {t.Fatalf("unauthenticated delete %d",noToken.Code)}
 empty:=requestProduction(t,mux,"DELETE","/api/v2/recovery",[]byte(`{"ids":[]}`),true)
 if empty.Code!=400 {t.Fatalf("empty delete %d",empty.Code)}
 badJSON:=requestProduction(t,mux,"DELETE","/api/v2/recovery",[]byte(`{"ids":["`+ids[0]+`"]} {}`),true)
 if badJSON.Code!=400 {t.Fatalf("trailing JSON accepted: %d",badJSON.Code)}
 // One selected entry, then the remaining selected entries (select-all).
 single:=recoveryRequest(t,mux,ids[1])
 if single.Code!=200||single.Counts.Deleted!=1 {t.Fatalf("single %+v",single)}
 for _,name:=range []string{"latest.json","latest.json.bak"} {
  if _,err=os.Stat(filepath.Join(root,ids[1],name));!os.IsNotExist(err){t.Fatalf("snapshot not deleted: %s, err=%v",name,err)}
 }
 listing:=requestProduction(t,mux,"GET","/api/v2/recovery",nil,true)
 if listing.Code!=200||strings.Contains(listing.Body.String(),ids[1])||!strings.Contains(listing.Body.String(),ids[0])||!strings.Contains(listing.Body.String(),ids[2]){
  t.Fatalf("list after partial deletion: %s",listing.Body.String())
 }
 all:=recoveryRequest(t,mux,ids[0],ids[2],ids[2])
 if all.Code!=200||all.Counts.Deleted!=2 {t.Fatalf("remaining selections %+v",all)}
 listing=requestProduction(t,mux,"GET","/api/v2/recovery",nil,true)
 if listing.Code!=200||strings.TrimSpace(listing.Body.String())!="[]" {t.Fatalf("list after clear %s",listing.Body.String())}
 again:=recoveryRequest(t,mux,ids[1])
 if again.Code!=200||again.Counts.Missing!=1 {t.Fatalf("repeat delete %+v",again)}
 load:=requestProduction(t,mux,"GET","/api/v2/project/load?id="+ids[0],nil,true)
 if load.Code!=200 {t.Fatalf("saved project accidentally deleted: %d",load.Code)}
 if data,err:=os.ReadFile(tmpl);err!=nil||string(data)!="keep" {t.Fatalf("template damaged: data=%q err=%v",data,err)}
}
func TestRecoveryDeletePreservesUnrelatedAutosaveFiles(t *testing.T) {
 t.Setenv("CARTORIG_DATA_DIR",t.TempDir())
 mux:=newMux()
 path,err:=productionPath("Autosaves",testProjectID)
 if err!=nil {t.Fatal(err)}
 if err=os.MkdirAll(path,0700);err!=nil {t.Fatal(err)}
 if err=os.WriteFile(filepath.Join(path,"notes.txt"),[]byte("keep"),0600);err!=nil {t.Fatal(err)}
 if err=os.WriteFile(filepath.Join(path,"latest.json"),recoveryFixture(t,testProjectID,3),0600);err!=nil {t.Fatal(err)}
 got:=recoveryRequest(t,mux,testProjectID)
 if got.Code!=200||got.Counts.Deleted!=1 {t.Fatalf("delete failed %+v",got)}
 data,err:=os.ReadFile(filepath.Join(path,"notes.txt"))
 if err!=nil||string(data)!="keep" {t.Fatalf("removed unrelated autosave data: %q %v",data,err)}
}
