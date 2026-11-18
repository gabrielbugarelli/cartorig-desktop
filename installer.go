//go:build windows && installer

package main

import (
	"embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

//go:embed installer_payload/CartoRig.exe
var payload embed.FS

const productName = "CartoRig"
const registryName = "CartoRigSceneComposer"

func main() {
	silent := false
	uninstallRequested := false
	for _, arg := range os.Args[1:] {
		if strings.EqualFold(arg, "/silent") {
			silent = true
		}
		if strings.EqualFold(arg, "/uninstall") {
			uninstallRequested = true
		}
	}
	if uninstallRequested {
		if err := uninstall(); err != nil {
			if !silent {
				message("Uninstall failed:\n"+err.Error(), 0x10)
			}
		} else {
			if !silent {
				message("CartoRig uninstalled.", 0x40)
			}
		}
		return
	}
	if err := install(); err != nil {
		if !silent {
			message("Installation failed:\n"+err.Error(), 0x10)
		}
		return
	}
	if !silent {
		message("CartoRig 2.0.4.1 installed.\n\nThe complete Natural Earth Admin 1 and Populated Places datasets are bundled and available without Internet.", 0x40)
	}
}

func install() error {
	dir := installDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := payload.ReadFile("installer_payload/CartoRig.exe")
	if err != nil {
		return err
	}
	app := filepath.Join(dir, "CartoRig.exe")
	if err := os.WriteFile(app, data, 0755); err != nil {
		return fmt.Errorf("cannot update CartoRig.exe: close the running CartoRig application and retry the installer; original error: %w", err)
	}
	self, err := os.Executable()
	if err != nil {
		return err
	}
	selfBytes, err := os.ReadFile(self)
	if err != nil {
		return err
	}
	uninstallPath := filepath.Join(dir, "Uninstall.exe")
	if err := os.WriteFile(uninstallPath, selfBytes, 0755); err != nil {
		return err
	}
	if err := shortcut(app); err != nil {
		return fmt.Errorf("atalho do Menu Iniciar: %w", err)
	}
	regPath := `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\` + registryName
	entries := [][2]string{{"DisplayName", productName}, {"DisplayVersion", "2.0.4.1"}, {"Publisher", "CartoRig"}, {"InstallLocation", dir}, {"DisplayIcon", app}, {"UninstallString", `"` + uninstallPath + `" /uninstall`}, {"NoModify", "1"}, {"NoRepair", "1"}}
	for _, e := range entries {
		typ := "REG_SZ"
		if e[0] == "NoModify" || e[0] == "NoRepair" {
			typ = "REG_DWORD"
		}
		cmd := exec.Command("reg", "add", regPath, "/v", e[0], "/t", typ, "/d", e[1], "/f")
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("registry %s: %s: %w", e[0], out, err)
		}
	}
	return nil
}

func uninstall() error {
	// Program files are installed per user. User projects saved elsewhere are untouched.
	dir := installDir()
	menu := filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs", "CartoRig.lnk")
	_ = os.Remove(menu)
	_ = os.Remove(filepath.Join(dir, "CartoRig.exe"))
	_ = exec.Command("reg", "delete", `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\`+registryName, "/f").Run()
	// Windows cannot delete an executable while it runs, so defer removal to cmd.
	command := `ping -n 3 127.0.0.1 > nul & rmdir /s /q "` + dir + `"`
	cmd := exec.Command("cmd", "/c", command)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Start()
}

func installDir() string { return filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "CartoRig") }
func shortcut(target string) error {
	menu := filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs")
	if err := os.MkdirAll(menu, 0755); err != nil {
		return err
	}
	path := filepath.Join(menu, "CartoRig.lnk")
	// PowerShell script runs locally, only using constructed installer paths.
	ps := `$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('` + psEscape(path) + `'); $s.TargetPath = '` + psEscape(target) + `'; $s.WorkingDirectory = '` + psEscape(filepath.Dir(target)) + `'; $s.Description = 'Editor offline de mapas cinematograficos'; $s.Save()`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%v: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}
func psEscape(s string) string { return strings.ReplaceAll(s, "'", "''") }
func message(msg string, flags uintptr) {
	dll := syscall.NewLazyDLL("user32.dll")
	proc := dll.NewProc("MessageBoxW")
	text, _ := syscall.UTF16PtrFromString(msg)
	title, _ := syscall.UTF16PtrFromString("CartoRig Setup")
	proc.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), flags)
}
