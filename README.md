# CartoRig Desktop v2.2.0 — UI/UX Etapas 2.1 e 2.2

Release estável Windows x64: [v2.2.0](https://github.com/gabrielbugarelli/cartorig-desktop/releases/tag/v2.2.0) · [Notas da versão](docs/releases/v2.2.0.md).

**Novidades:** Workspace ajustável com barras laterais redimensionáveis e layout persistente; Inspector contextual com seções **Basic**, **Position**, **Appearance** e **Advanced** para Callout, Label, Route, Marker, Region e multisseleção.

**Mantido da v2.1.0:** em MAP DISPLAY, os checkboxes **Land textures** e **Ocean textures** controlam terra e mar de maneira independente. Projetos `.cartorig` anteriores continuam compatíveis.

---

## Correção 2.0.4.1 — Classic layers ZIP

A exportação de camadas agora aceita nomes Unicode válidos de objetos geográficos, como `Bolívar`, `São Paulo`, `Αθήνα` e `東京`, de forma compatível com a normalização que já era usada pelo frontend. A versão 2.0.4 gerava esses nomes, mas o backend Go os rejeitava como “Invalid layer file”. A validação continua impedindo caminhos, separadores e nomes impróprios. O formato `.cartorig` não foi modificado. O aplicativo segue offline e abre no navegador local.

**Regressão:** `go test -tags fullgeo ./...` (inclui `TestClassicLayerUnicodeNames`, `TestClassicLayerRejectUnsafeNames`) e teste HTTP contra um projeto de 7 objetos com a região `Bolívar`.

# CartoRig 2.0.4.1 — Correção do Classic layers ZIP (offline)

**Novidade:** em **Looks → Personalize → Global Composition**, o checkbox **Show textures** permite ligar ou desligar instantaneamente a textura visual de qualquer look, sem mudar cores, bordas, rótulos nem redefinir ajustes finos. Desativar o checkbox remove do mapa a textura raster de base, papel/suporte, materiais de terra e oceano, acabamento de impressão, sombreado por imagem e relevo artístico rasterizado. Os parâmetros originais permanecem intactos. Ativar novamente devolve o acabamento visual do look.

**Independente do estilo:** a escolha é uma opção do projeto (`render_options.textures_enabled`), separada do `theme`; trocar entre os 36 looks não reativa a textura. Projetos da 2.0.3 sem essa chave continuam exibindo o acabamento original. A opção é salva em `.cartorig`, funciona com Undo/Redo e é aplicada pelo mesmo renderizador ao canvas e às exportações PNG/ZIP/produção. Exportação SVG continua vetorial e sem texturas raster, como antes.

**Testes:** `node tests/test_204_texture_toggle.mjs`, `python tests/test_204_texture_ui.py`, `go test -tags fullgeo ./...`. Veja `docs/CartoRig-2.0.4-Texture-Visibility.md`. A aplicação ainda usa navegador local; a migração Electron/Wails fica para uma etapa futura. Executáveis Windows gerados por cross-compilação ainda requerem homologação nativa.

---

# CartoRig 2.0.3 — Geographic Map Labels (offline)

**Base:** aprovado 2.0.2 UI Cleanup R3. Nomes geográficos são uma camada de composição opcional, separada dos objetos que o usuário desenha.

Em **Looks → Personalize → MAP LABELS**, ligue/desligue independentemente: países, estados/províncias, capitais nacionais, capitais regionais, cidades, continentes, oceanos e mares. Em **Typography & density**, configure por categoria o tamanho e a cor; ajuste ainda família tipográfica, densidade e contorno. As alterações são reversíveis por Undo/Redo, salvas em `.cartorig`, e mantidas ao trocar o look.

Novo projeto: países, capitais nacionais, oceanos e mares ficam habilitados; as outras categorias começam desativadas. Projetos antigos continuam válidos e não exibem novos rótulos automaticamente até que o usuário os ative. O algoritmo prioriza nomes relevantes, evita colisões e adapta a quantidade de rótulos ao zoom. Nenhuma chamada externa é necessária.

**Fontes:** nomes políticos e cidades derivados de Natural Earth já incluído no produto; posições de oceanos e mares são âncoras editoriais documentadas (não geometrias hidrográficas oficiais). Alguns nomes são em inglês, seguindo a fonte instalada. A importação de GeoJSON continua disponível; os rótulos automáticos de terceiros exigem integração futura com o catálogo de nomes.

**Exportação:** a composição PNG/produção inclui os nomes; os ZIPs de layers incluem `Map_Labels.png` e o SVG inclui textos vetoriais quando exportado no escopo de cena. Máscaras de regiões e exportações de objetos selecionados não recebem rótulos globais. Renderização em tiles usa a mesma composição de nomes.

**Testes:** `node tests/test_203_map_labels.mjs`; `python tests/test_203_map_labels_ui.py`; `go test -tags fullgeo ./...`. A build Windows nativa continua sujeita à homologação em Windows. Leia `docs/CartoRig-2.0.3-Map-Labels.md`.

---

**UI Polish R2:** Geography search has no Results/placeholder card; File now owns GeoJSON import and Map styles management; Looks gallery no longer shows redundant metadata. See `docs/CartoRig-2.0.2-UI-Polish-R2.md`.

# CartoRig 2.0.2 — Refined Workspace (offline source)

**Status:** CartoRig 2.0.2 UX revision source, ready for Windows native qualification. See `docs/CartoRig-2.0.2-UX-Revision.md` for the study and implementation decisions. The bundled offline cartographic datasets, rendering algorithms, 36 looks, project format (`schema_version: 2.0.0`), creative tools, export algorithms, and undo/redo are preserved from 2.0.1. The schema is intentionally **not** bumped because no format migration is needed.

## UI/UX improvements in 2.0.2

- Looks has distinct **Choose look** / **Personalize** views, no redundant current-look card, and a one-click path to global composition defaults, per-type effects, atmosphere, typography and artistic finish. All 36 offline previews and the user style library remain available.
- The Inspector shows a selection context/header and common identity/composition controls before secondary effects. Advanced appearance is a collapsible section, and Marker uses a single graphic symbol library rather than a duplicate selector.
- The Export Studio shows only format-relevant controls, keeps all 7 output formats, presets and preflight, and provides focus management / Escape / Tab trapping. Quick PNG / ZIP canvas defaults live in a separate collapsible Export Studio section; per-export dimensions remain independent.
- The Geography panel no longer exposes dataset integrity diagnostics, full source URLs or verification buttons. GeoJSON import stays available; offline integrity still runs in backend and release verification.
- Narrow-window panels open and close with one click; the canvas takes the available space, with compact drawers, reachable stage toggles and horizontal toolstrip scrolling.
- Improved keyboard navigation in tabs and the Scene tree, accessible lock labels, restrained typography, consistent focus outlines and reduced-motion support.
- Version number updated in app, Go server, Windows build gate and installer. Windows CI artifact publishing paths now agree with the build script.

## Tests and release status

Run `go test -tags fullgeo ./...`, `node tests/test_14_style_system.mjs`, `node tests/test_147_material_catalog.mjs`, `node tests/test_20_production_contracts.mjs`, and `python tests/test_202_ux_refinement.py` and `python tests/test_202_ux_revision.py` (requires Playwright + Chromium). For native Windows acceptance, use `./scripts/build-windows.ps1` from PowerShell 7+ on Windows. Building a Windows executable from a non-Windows host is **not** native Windows installer qualification.

**Important:** Existing labels and internal schema strings related to earlier modules are retained where they describe compatibility/portable formats, not the product version. Historical documentation is preserved below.

---

# CartoRig 2.0 — Production

**Candidata à homologação (Windows x64).** Veja [documentação da 2.0](docs/CartoRig-2.0-Production.md) para funcionalidades, instruções, testes executados e limitações verificadas.

---

# CartoRig 1.4.5 — Scene Looks static preview architecture correction

This release fixes the **F5/page-reload thumbnail replacement bug** from 1.4.4.
The nine original Scene Looks now display immutable 288×162 PNGs generated by
`tools/generate_scene_look_previews.py` from the production Canvas renderer.
All nine files are bundled inside the offline executables; no JavaScript
on-startup gradient placeholders, async bitmap replacement, or preview
Canvas rendering remains. The Style Studio owns one persistent gallery.
Go SHA-256 locks prevent shipping stale/missing thumbnail assets.

Reproduction and tests: [`docs/CartoRig-1.4.5-Scene-Looks-Static-Previews.md`](docs/CartoRig-1.4.5-Scene-Looks-Static-Previews.md).
The Linux Chromium environment blocks full browser navigations; Windows real
HTTP/F5 integration remains a required but not locally executed CI gate.

## Changes preserved from CartoRig 1.4.3

Earlier version 1.4.3 followed 1.4.2, addressing user feedback that the two terrain looks were visually indistinguishable. Shaded Relief remains the original restrained topographic map; Terrain Cinematic now uses the bundled ETOPO land raster, deep solid ocean, high-contrast desaturation, subtle texture shading, atmospheric tint and vignette. See `docs/CartoRig-1.4.3-Look-Differentiation.md`. This release retains the fixes from 1.4.2, which replaced 1.4.1. It fixes **global Revert**, **theme switching overriding the visual look**, and fills in missing Style Studio controls: installed texture selection, ocean solid/raster mode, border dash style, grid interval and geographic coordinate labels, texture shading source, per-type Shadow/Glow defaults, font/halo typography defaults, and actual WGS84 Region bounds. It preserves 1.3 authoring tools, the 1.4 effects compositor and complete offline world data.

User style `.cartorigstyle` exports retain UUID, origin metadata and bounded asset references. Conflicts never overwrite another style silently. Unsupported external assets are rejected until they exist in the project. A style may have no external asset references; the installed Natural Earth textures are bundled.

Selecting a new preset **resets scene-wide theme overrides** to the newly selected preset's defaults; explicit *object* overrides are always preserved. To intentionally preserve global overrides while switching through the CommandBus, `ApplyTheme` supports `keep_global_overrides:true`.

**Terrain limitation:** bundled rasters are color textures, not standalone elevation DEMs. Controls describe them as *texture shading* rather than physical hillshade. This release does not claim a new DEM.

**Windows qualification:** the Windows x64 setup and portable programs are cross-compiled and verified for offline geodata inclusion. Native Windows install/update/uninstall and browser/loopback execution **remain untested** outside the available Linux environment. Do not report G5 native Windows as passed.

Tests added: `tests/test_142_completion.mjs` and `tests/test_142_style_e2e.py`, including UI, exported schema, metadata, UTF-8, inheritance, Go library validation, old project compatibility, pixel alpha and real geography. See `docs/CartoRig-1.4-Acceptance.md`.

# CartoRig 1.4 — Cinematic Styles

Standalone **Windows 10/11 x64** cartographic scene composer (Go local server + HTML/CSS/JavaScript/Canvas2D). **Static map scenes only**; independent aligned PNG layers for external video editors. No timeline, animation, Electron, Wails or mandatory Internet connection.

## What's new in 1.4

- Style Studio with original seven + Historical Atlas / Terrain Cinematic presets, live preview, editable global palette, texture grading and static atmosphere.
- StyleResolver: theme → category → group inheritance → object overrides, precise per-property resets and full Undo/Redo. A customized Country/State remains customized after theme changes.
- Region Editor with fill/stroke opacity, dash, shadow, glow and blend; explicit, reversible Replace Geography; multi-select editing and overlapping Region cycling.
- Alpha-derived Shadow/Glow for geographic and creative objects, isolated Group composition and Normal/Multiply/Screen/Overlay modes.
- User `.cartorigstyle` presets with secure import/export and local library persisted across projects (no network account).
- Projected geometry `Path2D` caching to avoid processing world polygons every time colors change.

Full notes: [`docs/CartoRig-1.4-Release-Notes.md`](docs/CartoRig-1.4-Release-Notes.md). Contract and acceptance: [`docs/CartoRig-1.4-Acceptance.md`](docs/CartoRig-1.4-Acceptance.md).

## Offline datasets / compatibility

The complete version-locked Natural Earth Admin 1 **4,596** worldwide features and populated places **7,342** points are bundled within the executable; no first-run download. Legacy 1.3 `.cartorig` and V1 `.mapcomposer.json` support retained. The source distribution includes official data, source/geometry integrity metadata and build/test scripts.

## Tests

```sh
go test -tags fullgeo ./...
node tests/test_world_real.mjs
node tests/test_geo_engine.mjs
node tests/test_optimized_search.mjs
node tests/test_13_creative_geometry.mjs
node tests/test_14_style_system.mjs
python tests/test_13_creative_e2e.py
python tests/test_14_style_e2e.py
python tests/test_14_style_pixels.py
python tests/test_world_real_embedded_browser.py
```

Browser tests need Playwright, Pillow and Chrome/Chromium. Windows build (Go, Node, Python, Playwright):

```powershell
./scripts/build-windows.ps1
```

The script insists on real worldwide geodata and blocks Windows acceptance if native Chromium/Go integration or installer smoke tests fail. `.github/workflows/cartorig-1.4.yml` executes it in a Windows runner; it is included but **not executed by this Linux cross-build**.

## Limits

Native Windows GUI installation/upgrade/uninstall and actual Windows host testing **pending**. Shading uses bundled terrain texture grading, not computed physical hillshade from a DEM. Full production export/8K tiles/advanced SVG and autosave/recovery belong to later 2.0 scope. Natural Earth source data are public domain; custom imported icons/fonts retain their own licensing restrictions. No font files are redistributed.

## CartoRig 2.0 — Scene Looks Reference Collection

A galeria incorpora 9 Scene Looks originais e 27 presets novos, baseados no ZIP de 27 referências visuais. Use o filtro da galeria para navegar. Os cartões usam prévias fiéis ao renderer do CartoRig, não fotos usadas como falsos basemaps. Consulte `docs/SCENE_LOOKS_REFERENCE_AUDIT.md` e `docs/RELEASE_NOTES_1.4.7.md`.


## UI Cleanup R3 (2.0.2)

A revisão de interface removeu instruções permanentes e consolidou comandos sem alterar o motor.
O projeto agora é nomeado no cabeçalho do canvas, `Save as .cartorig` fica em File,
IDs técnicos ficam em seções recolhidas e o Export Studio exibe alertas apenas
quando são pertinentes. Os 36 looks e formatos de exportação visual permanecem.
Veja [docs/UI_CLEANUP_R3.md](docs/UI_CLEANUP_R3.md).

Teste de regressão de interface: `python tests/test_202_ui_cleanup_r3.py`.
