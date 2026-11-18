# CartoRig 1.4.7 — Scene Looks 2.0

## 36 material art directions

| Scene Look | Família | Suporte | Terra | Oceano | Acabamento | Perfil de relevo |
|---|---|---|---|---|---|---|
| Cinematic Dark | Dark / Cinematic | dark_grain | mineral_grit | deep_sea | ink_grain | dark |
| Vintage Atlas | Paper / Parchment | paper_clean | paper_fibrous | marine_noise | ink_grain | soft |
| Tactical Ops | Documentary / Tactical | archival_sheet | tactical_noise | marine_noise | print_plate | soft |
| Shaded Relief | Terrain / Relief | none | mineral_grit | marine_noise | none | natural |
| Satellite Earth | Terrain / Relief | none | mineral_grit | marine_noise | none | natural |
| Nightfall | Dark / Cinematic | dark_grain | dark_grain | deep_sea | ink_grain | dark |
| Elevation ETOPO | Terrain / Relief | none | mineral_grit | marine_noise | contour_etch | natural |
| Historical Atlas | Paper / Parchment | paper_aged | paper_fibrous | marine_noise | ink_grain | engraved |
| Terrain Cinematic | Terrain / Relief | dark_grain | mineral_grit | deep_sea | dry_brush | rugged |
| Noir Monochrome | Dark / Cinematic | dark_grain | ink_grain | deep_sea | print_plate | dark |
| Oceanic Engraving | Ocean / Nautical | paper_fibrous | engraving_lines | marine_waves | copperplate | engraved |
| Sultan Parchment | Paper / Parchment | paper_aged | paper_fibrous | marine_noise | ink_grain | soft |
| Imperial Conquest | Documentary / Tactical | archival_sheet | dry_brush | marine_noise | print_plate | rugged |
| Cold War Archive | Documentary / Tactical | document_wear | ink_grain | deep_sea | print_plate | dark |
| Iron Curtain Noir | Dark / Cinematic | dark_grain | tactical_noise | deep_sea | document_wear | dark |
| Heritage Documentary | Paper / Parchment | linen | watercolor_wash | marine_noise | ink_grain | soft |
| Copper Topography | Engraved / Printed | paper_foxed | copperplate | marine_noise | contour_etch | engraved |
| Contour Radar | Documentary / Tactical | dark_grain | contour_etch | marine_waves | tactical_noise | engraved |
| Sepia Expedition | Paper / Parchment | paper_aged | dry_brush | marine_noise | document_wear | natural |
| Antique Campaign | Engraved / Printed | paper_foxed | engraving_lines | marine_noise | print_plate | engraved |
| Explorer Chart | Ocean / Nautical | paper_clean | paper_fibrous | marine_waves | engraving_lines | soft |
| Turquoise Bathymetry | Ocean / Nautical | none | mineral_grit | marine_waves | ink_grain | bathymetric |
| Compass Antiquity | Ocean / Nautical | paper_aged | engraving_lines | marine_noise | print_plate | engraved |
| Desert Caravan | Paper / Parchment | paper_foxed | mineral_grit | marine_noise | dry_brush | rugged |
| Maritime Manuscript | Ocean / Nautical | paper_fibrous | watercolor_wash | marine_waves | copperplate | soft |
| Alpine Survey | Terrain / Relief | none | mineral_grit | marine_noise | contour_etch | rugged |
| Fantasy Cartographer | Engraved / Printed | canvas_weave | engraving_lines | marine_waves | dry_brush | engraved |
| Obsidian Minimal | Dark / Cinematic | dark_grain | none | none | none | none |
| Great Lakes Depth | Ocean / Nautical | none | watercolor_wash | deep_sea | contour_etch | bathymetric |
| Vintage Coast Survey | Ocean / Nautical | paper_foxed | engraving_lines | marine_waves | print_plate | soft |
| Age of Sail | Ocean / Nautical | paper_aged | engraving_lines | marine_waves | copperplate | engraved |
| Tropical Explorer | Ocean / Nautical | canvas_weave | watercolor_wash | marine_waves | ink_grain | natural |
| Empire Spotlight | Dark / Cinematic | dark_grain | mineral_grit | deep_sea | document_wear | dark |
| Neon Heritage | Dark / Cinematic | dark_grain | canvas_weave | marine_noise | print_plate | dark |
| Engraved Chronicles | Engraved / Printed | paper_fibrous | copperplate | marine_noise | engraving_lines | engraved |
| Crimson Geopolitics | Dark / Cinematic | dark_grain | mineral_grit | deep_sea | tactical_noise | dark |

## Contratos de renderização e fonte

1. O Scene Look só modifica materiais e aparência, nunca a geometria Natural Earth ou âncoras WGS84.
2. Suporte e impressão são filtros artísticos de papel/documento. Materiais de terra e oceano são mascarados com os polígonos reais; não inventam costa ou contornos.
3. Relevo usa a textura `shadedrelief.jpg` instalada e gradação visual. `bathymetric` representa uma linguagem artística do oceano, não dados medidos de profundidade.
4. Texturas aplicadas ao WorldMap não modificam as cores de Regions explicitamente personalizadas.
5. Exportação e preview compartilham `renderScene`. A galeria usa 36 PNGs nativos gerados pelo mesmo renderizador; nenhum placeholder dinâmico.
6. Todos os arquivos de material são tiles RGBA originais gerados localmente por `tools/generate_look_materials.py`, com hashes SHA256 em `assets/look-materials/manifest.json`.
7. Mudanças de material, perfil ou intensidade passam por `SetThemeProperty` e são persistidas com Undo/Redo.

## Validação

- `node tests/test_147_material_catalog.mjs` — cobertura 36/36, 6 famílias, 21 tiles, comandos e esquema.
- `python tests/test_147_material_pixels.py` — máscaras terra/mar, país explícito, determinismo.
- `python tests/test_147_gallery_ui.py` — seleção, filtros por família, controles e Undo.
- `python tests/test_145_scene_look_reload.py` — 4 inicializações/48 trocas sem placeholder.
- `go test -tags fullgeo ./...` — conteúdo embutido e SHA256 das texturas/miniaturas, geografia mundial.

## Limites de fidelidade

Os estilos são tratamentos artísticos com texturas procedimentais, não reproduções de elementos editoriais desenhados nas referências do usuário. Navios, símbolos históricos, fronteiras antigas, DEM científico e dados batimétricos adicionais não foram incorporados. A instalação e a execução nativas no Windows continuam sem homologação física neste ambiente.
