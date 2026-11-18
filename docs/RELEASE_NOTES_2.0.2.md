# Atualização de UI/UX da CartoRig 2.0.2 — revisão da organização (17/11/2026)

Após revisão das capturas e do código da 2.0.2, foram aplicadas correções sem mudar o identificador interno da versão nem o esquema do projeto:

- **Looks**: cartão redundante `Current Look / Personalize` removido; permanecem as abas `Choose look` e `Personalize` e os 36 looks.
- **Geography**: removidas da interface as explicações e a seção de verificação/diagnósticos com hashes e fontes. A importação manual GeoJSON permanece acessível. A verificação de integridade está disponível no backend e nos testes de release, não no editor cotidiano.
- **Global composition**: `STATE BOUNDARIES & GEOGRAPHY`, `BORDERS & GRID`, `LAND & OCEAN`, `ATMOSPHERE`, `DEFAULT TYPOGRAPHY` e `OBJECT TYPE DEFAULTS & EFFECTS` aparecem no início da Personalização; materiais, relevo e textura foram agrupados sob `ARTISTIC FINISH`.
- **Export Studio**: resolução e transparência do canvas do projeto/Quick PNG e ZIP migradas para `Quick export & scene canvas defaults`. Os controles de tamanho/transparência da exportação específica permanecem no painel principal, evitando confundir propriedades salvas do projeto com a exportação atual.
- **Preservado**: estilos, materiais, Undo/Redo, importação geográfica, formatos de exportação, datasets offline, formato de projeto e motor de renderização.

**Validação**: teste novo `tests/test_202_ux_revision.py`, teste anterior `test_202_ux_refinement.py` adaptado, Go backend, geodados SHA, suíte JavaScript, testes de rendering/Export Studio e HTTP Go real: passaram no ambiente Linux. Os arquivos Windows foram compilados, não executados em Windows.

---

# CartoRig 2.0.2 — Refinamento de interface

Data: 17/11/2026

## Objetivo

Evolução da interface 2.0.1 sem retorno à densidade visual da 2.0. Foram preservados o formato de projeto `schema_version: 2.0.0`, os dados de geografia offline, o mecanismo de Canvas/renderer, ferramentas de edição, 36 looks, efeitos, presets, Undo/Redo e exportadores. A supressão do seletor textual redundante de símbolos é intencional: a biblioteca gráfica continua com todos os símbolos.

## Alterações principais

1. **Looks:** barra de look atual e modos `Choose look`/`Personalize`; edição em um clique; 36 cards intactos com busca, filtros e prévias; estilos salvos permanecem na galeria; opções de canvas/mapa movidas junto à personalização sem duplicar IDs.
2. **Inspector:** contexto da seleção no cabeçalho; identidade e composição antes de efeitos rápidos; seção de aparência avançada recolhível por tipo; opções de Marker sem seletor duplicado.
3. **Export Studio:** controles de escopo, saída, máscaras, transparência, granulação e tiles aparecem de acordo com o formato. Nenhum formato foi retirado. Gestão de foco, Escape e proteção contra atalhos disparados por trás dos diálogos.
4. **Navegação:** painéis sincronizados com `aria-pressed`, abertura e fechamento em um clique inclusive em janelas estreitas. Em 760 px ou menos o canvas ocupa a largura disponível, com painéis em drawers que não cobrem os próprios botões de abertura.
5. **Acessibilidade e acabamento:** papéis de abas, navegação por setas, árvore de camadas operável por teclado, rótulos de lock, estados de foco, escala tipográfica, espaçamento e movimento reduzido.
6. **Distribuição:** versão 2.0.2 aplicada ao servidor Go, interface, instalador e scripts. Corrigido o nome dos artefatos do workflow Windows.

## Verificações concluídas neste ambiente

- `tools/prepare_offline_datasets.py --verify-only`: passou (4.596 regiões Admin 1, 7.342 cidades, bloqueios SHA).
- `go test -tags fullgeo ./...`: passou.
- Testes JavaScript de geografia, ferramentas criativas, estilo, catálogo de materiais e contratos de produção: passaram.
- `tests/test_20_production_ui.py`, `test_20_tiles_browser.py`, `test_147_material_pixels.py`: passaram.
- `tests/test_147_gallery_ui.py`, `test_201_ux_redesign.py` (adaptados para o fluxo 2.0.2) e `test_202_ux_refinement.py`: passaram.
- `test_202_ux_refinement.py` testou panels em 390, 550, 790 e 1100 px, além de um workspace em 1600 px, sem erros de JavaScript.
- Executáveis Windows x64 Portable e Setup gerados por **compilação cruzada em Linux** com `GOOS=windows`, `GOARCH=amd64`, `-tags fullgeo`; são artefatos produzidos, não binários homologados nativamente.

## Limitações de validação

- Instalação/desinstalação/execução real em Windows 10/11, comportamento da WebView/navegador padrão e CI do GitHub Actions permanecem não executados neste ambiente.
- O estudo de UX é heurístico, não representa pesquisa ou certificação WCAG com usuários reais.
- O motor cartográfico e o formato de projeto não foram reescritos; isso é proposital para maximizar a compatibilidade.

## Como compilar no Windows

No Windows x64, com PowerShell 7+, Go 1.23+, Python, Node e Playwright/Chromium instalados:

```powershell
./scripts/build-windows.ps1
```

A compilação final só é considerada homologada quando essa suíte for executada com sucesso no próprio Windows.
