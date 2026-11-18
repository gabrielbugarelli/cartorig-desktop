# CartoRig 1.4.2 — Correção integral dos defeitos auditados

Versão-base: CartoRig 1.4.1. Escopo normativo: CR-SPEC-2.0, RF-STYLE-001..009, RF-REG-001..007 e AT-043..052.

## Correções de código verificáveis

| Item auditado | Alteração implementada | Teste |
|---|---|---|
| `Revert` de cores, números e booleanos | `validateThemeField()` aceita `null` somente para remover override; campos presentes continuam estritamente validados | `test_142_completion.mjs`, `test_142_style_e2e.py` |
| Troca de tema não muda o visual | `ApplyTheme` reinicia overrides globais com defaults do tema selecionado; estilos de Region/objetos permanecem intocados; opção explícita `keep_global_overrides` | `test_142_completion.mjs`, `test_14_style_system.mjs`, navegador |
| Miniaturas erradas | Prévia de cada tema usa seu próprio conjunto de defaults; não reutiliza os overrides do tema ativo | `app.js` e E2E em navegador |
| Controles globais incompletos | Textura instalada e modo de oceano; padrão de borders, espaçamento e labels de grid; textura usada no shading; efeitos/fontes/halos por tipo de objeto | `test_142_style_e2e.py` |
| Region Inspector sem bounds numéricos | Coordenadas extremas WGS84 são calculadas a partir da geometria real instalada ou embutida no projeto | `test_142_style_e2e.py` |
| `.cartorigstyle` sem identificação | Export conserva UUID, metadados de origem/versão e referências de assets; import valida paths, hashes, MIME e conflitos de identidade | `test_142_completion.mjs`, `style_library_test.go` |
| Duplicação/reutilização da biblioteca | Duplicate sempre gera novo UUID; Rename/Delete de estilo global anexam antes ao CommandBus; capacidade do armazenamento local ampliada | `test_142_completion.mjs`, Go |
| Esquema inconsistente | JSON Schema do projeto inclui `theme.type_defaults` e `style_library`; esquema de estilos documentado | `docs/CartoRig_2.0_Project_Schema.json` |
| Risco de regressão | Testes RF-STYLE/REG + fonte real mundial e ferramentas criativas 1.3 | Suítes abaixo |

## Testes executados

- `go test -tags fullgeo ./...`: aprovado.
- `node tests/test_142_completion.mjs`: aprovado.
- `node tests/test_14_style_system.mjs`: aprovado.
- `python tests/test_142_style_e2e.py`: aprovado.
- `python tests/test_141_visibility.py`: aprovado.
- `python tests/test_14_style_pixels.py`: aprovado (holes, Shadow/Glow e grupos).
- `python tests/test_14_style_e2e.py`: aprovado (previews, PNG, biblioteca, arquivo de projeto).
- `node tests/test_world_real.mjs`: aprovado com 4.596 regiões e 7.342 cidades.
- `node tests/test_optimized_search.mjs`: aprovado.
- `node tests/test_13_creative_geometry.mjs`: aprovado com 94 referências WGS84.
- `python tests/test_13_creative_e2e.py`: aprovado (rotas, edição, PNG, 8K, Unicode, reabertura).
- `python tests/test_world_real_embedded_browser.py`: aprovado com dois GeoJSON mundiais reais e quatro regiões independentes.
- `python tools/prepare_offline_datasets.py --verify-only`: aprovado (hash e contagem).

## Condições que NÃO estão homologadas

- Execução nativa, atualização/desinstalação e UI servida pelo binário em Windows 10/11 x64: **pendentes**.
- Desempenho e consumo máximo de memória em três perfis Windows: **pendentes**.
- Testes manuais exaustivos de alt-click em Regions sobrepostas com furos e antimeridiano: **pendentes**; existência do código não equivale à homologação completa.
- Hillshade físico obtido de DEM: **não implementado**, pois a especificação permite um fallback honesto como `Texture contrast` quando só há raster colorido.
- Assets de preset não presentes no projeto: **bloqueados** com diagnóstico; o arquivo `.cartorigstyle` guarda referências verificáveis, não inclui automaticamente os bytes de recursos de terceiros.

O pacote não deve ser divulgado como Windows homologado até completar os itens pendentes. A versão 1.4.2 é uma correção localmente validada dos defeitos de 1.4.1.
