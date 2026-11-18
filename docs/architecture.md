# CartoRig 1.1 — Architecture (M0/M1)

## Runtime

Go 1.23+, standard library only. Embedded assets served on a random `127.0.0.1` TCP port. No Electron/Wails/Qt or external map provider. The browser is the renderer and editor; the bundled executable opens the local URL.

- `main.go`: loopback-only HTTP host, no-store health/session/ZIP endpoints and session CSRF token.
- `assets/scene-core.js`: serializable SceneStore, strict Scene Graph, command execution, snapshot-based Undo/Redo (120 entries), legacy conversion.
- `assets/scene-renderer.js`: single Canvas 2D spatial pipeline used for preview and PNG exports; export never includes selection handles.
- `assets/app.js`: DOM and command orchestration, geographic search, tree selection, Inspector, tool interactions, Save/Open, export.
- `assets/countries.json`: unchanged original 177-feature 1:110m Natural Earth base.
- `assets/*.jpg`: unchanged offline raster backgrounds.
- `installer.go`: Windows per-user install and uninstaller.

## State flow

User action → `SceneStore.execute(command)` → validate → mutate document → validate scene → snapshot prior state → update revision → notify UI/renderer/cache. On failure, rollback to prior document. Undo restores the complete prior document and selected IDs; Redo restores the subsequent snapshot. UI selection and Solo mode are transient.

## Scene tree

`scene.root_ids` holds bottom-to-top order. Each Group has ordered `children`; every child has `parent_id`. The renderer traverses bottom-to-top, while the Scene Explorer displays top-to-bottom. Objects are referenced by UUID, not by title or ISO code. Nested groups render to isolated offscreen surfaces when group opacity differs from 1.

## Delivery

`go build` compiles the portable executable. `-tags installer` builds the installer with the portable executable embedded. `/api/scene-bundle` accepts complete PNG layers, a project JSON and a manifest; responds with ZIP. The client never needs a video editor, online service, or node dependencies.

## Security

Only loopback binds; a random port prevents collisions. Mutating requests carry a random 256-bit process session token and matching same-origin header; hostile Host headers and cross-origin POSTs are rejected. The server uses payload size and filename limits. This is a local workstation tool, not a public web server.
