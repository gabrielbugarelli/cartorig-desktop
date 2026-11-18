# CartoRig 2.1.0 — Wails 3 desktop

This branch is based on CartoRig 2.0.4.1. The Wails build launches a native
Windows WebView2 window and routes the existing CartoRig API through its
in-process asset server without opening localhost TCP ports.

Run `scripts/build-wails3-portable.ps1` on Windows with Go >= 1.26.
Output: `dist/CartoRig-2.1.0-Wails3-Portable-Windows-x64.exe`.

The original 2.0.4.1 browser mode remains accessible without the `wails`
build tag. Wails desktop mode uses the `wails,production,fullgeo` tags.

Requires Microsoft WebView2 Runtime installed on the user's computer.
Desktop execution and large 4K/8K exports require native Windows testing.
