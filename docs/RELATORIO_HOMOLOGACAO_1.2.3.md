# CartoRig 1.2.3 — Relatório de implementação e validação

**Data:** 16/11/2026  
**Escopo:** Geographic Engine 1.2.3 (Go + HTML/JS Canvas), Windows x64.  
**Status:** Fontes oficiais completas embutidas, motor e interface validados com geometrias reais no Linux; binários Windows x64 produzidos por compilação cruzada. **O instalador Windows não foi executado em um PC Windows nesta sessão**. O código inclui um pipeline GitHub Actions para realizar a homologação nativa antes de publicar uma distribuição verificada.

## Fontes verificadas e instaladas no pacote

| Pacote | Escala | Feições oficiais | Tamanho | SHA-256 |
|---|---|---:|---:|---|
| Natural Earth Admin 1 global | 1:10m | 4.596 polígonos/multipolígonos | 44.484.806 bytes | `163108e4628cef6afe0c7f3aeace21dcfa327bff59c91b65e9b60dbaf0739904` |
| Natural Earth Populated Places | 1:10m | 7.342 pontos | 19.359.003 bytes | `9b8e3de09048ef00dfc70357dbb9fa324493f214b5e0ae4daf1aa79a8d10116b` |

Admin1: <https://github.com/datasets/geo-ne-admin1/blob/main/data/admin1.geojson>, SHA de blob Git `15b12703a702387c48da9183016b1101974f0160`.  
Cidades: <https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_populated_places.geojson>, SHA de blob Git `376fb028c390a7a23213800ae4babaa6f534a0f3`.

São **4.596 feições na fonte real**, não 4.524: a versão anterior mostrava apenas 4.524 resultados pesquisáveis por deduplicar nomes iguais no mesmo país. Esta versão preserva todos os IDs diferentes, mesmo quando nomes são idênticos (por exemplo Kyiv cidade versus oblast, ou municípios diferentes com o mesmo nome). Também preserva sete polígonos administrativos sem nome na fonte, com rótulo identificável e sem fabricar geometrias ou nomes.

Os arquivos estão efetivamente integrados em `assets/geodata/` e embutidos no executável por `go:embed`. O aplicativo não precisa solicitar download inicial. O manifesto `offline_integrity.json` e `/api/geodata/verify` conferem fonte, escala, quantidade, versão Git, SHA-256, cobertura e integridade; dados corrompidos em cache não são anunciados como instalados.

## Matriz GEO / UX

| ID | Implementação | Verificação |
|---|---|---|
| GEO-001 | Identificação **1.2.3 GEO** na interface, API e instalador | Captura de tela + compilação PE |
| GEO-002 | Aliases multilíngues, nomes oficiais, alternativos e locais nos campos da fonte; normalização de acentos; nomes editoriais conhecidos em português | Baviera/Bayern/Bavaria e Munique/München/Munich no navegador com fonte real; nomes portugueses disponíveis, sem tradução inventada para entradas sem nome traduzido |
| GEO-003 | **7.342** Populated Places 10m embutidos | Teste Node do catálogo com todos os IDs; renderização de marcador real |
| GEO-004 | **4.596** feições Admin1 10m embutidas, integridade das geometrias e anéis, homônimos preservados | Node valida todas as geometrias e caixas de enquadramento; fonte e SHA verificados |
| GEO-005 | Busca, criação independente, enquadramento, exportação e projeto | Chromium com geometrias reais Ontario, California, Bavaria e Mato Grosso; PNG Full HD; ZIP de camadas exercitado com imagens reais (transporte ZIP simulado na verificação Linux) |
| GEO-006 | Admin1 e cidades completos no EXE e no instalador Windows | `go:embed` obrigatório; SHA lock; binários PE32+ 64-bit x64; sem tráfego externo necessário para as bases instaladas |
| GEO-007 | Diagnóstico com fonte, escala, contagem, revisão Git e SHA256 | API e painel Verify geodata |
| UX-001 | Baviera (Bayern); Munique (München); tradução de país quando disponível | Captura Chromium |
| UX-002 | Estados instalado, carregando, ausente e inválido | Backend e mensagens distintas |
| UX-003 | Fit center com feedback de enquadramento e antimeridiano | Teste Chromium com polígonos reais; Node dateline |
| UX-004 | Confirma criação de nova camada/objeto | Teste Chromium |
| UX-005 | Filtros combináveis de continente, país e tipo | Teste de busca tipada e filtro; caso São Paulo município/estado |
| UX-006 | Fonte, escala, ID de geometria/feição e integridade | Inspector, manifest/API |
| UX-007 | Botão de verificação; reparo de dados obtidos em cache; dados embutidos verificados são imutáveis e, se o executável for danificado, o reparo é reinstalar o aplicativo | Backend de cache + validação de hashes e política de instalação |

## Homologação real executada na sessão

- `go test ./...`: aprovado.
- `go test -tags fullgeo ./...`: aprovado.
- `node tests/test_world_real.mjs`: aprovado — **todos os 4.596 polígonos** e **7.342 pontos** preservados, anéis, ilhas, furos, antimeridiano, bounding boxes, famílias de nomes e regiões distintas.
- `node tests/test_geo_engine.mjs`: aprovado.
- `python tests/test_world_real_embedded_browser.py`: **aprovado com os dois GeoJSON reais de 10m integralmente carregados no Chromium**: aliases internacionais, 4 camadas de polígonos independentes, zoom/fit, alteração de estilo independente, criação de marcador de Munique, exportação Full HD com transparência, PNG individual de cada região e alinhamento do tamanho das camadas, salvamento e reabertura dos quatro polígonos reais. **Somente o transporte HTTP da API e a montagem do arquivo ZIP foram simulados** neste teste local; as geometrias e os pixels exportados são reais.
- `python tests/test_br_states_e2e.py`, `tests/test_123_alias_city_e2e.py`, `tests/test_world_admin1_e2e.py`, `tests/test_m1_regressions.py`, `tests/browser_smoke.py`, `tests/example_smoke.py`: aprovados; alguns continuam usando dados sintéticos exclusivamente para regressões de software, e **não** são invocados como prova da cobertura mundial real.
- Go local HTTP `/api/geodata/verify`: `global_offline_ready = true`, SHA oficiais corretos, ambas fontes `bundled` e `verified`.
- Executáveis Windows portable e setup: compilados por `GOOS=windows GOARCH=amd64 CGO_ENABLED=0` e reconhecidos como PE32+ GUI x86-64. **Não foi executado um teste real de instalação Windows**.

## Risco residual e teste Windows necessário

O navegador Chromium disponibilizado neste ambiente bloqueia navegação a `127.0.0.1` e a arquivos locais por política administrativa. Assim, o teste real de navegador aqui usa as fontes geográficas completas transferidas comprimidas, com transporte HTTP simulado. A prova nativa no Windows deve rodar `python tests/test_world_real_e2e.py` com o app Go real e ZIP gerado pelo backend, seguida de `python tests/test_windows_installer.py` para instalar, comparar o executável embutido e conferir registro. Esses testes e a trava de publicação estão implementados em `scripts/build-windows.ps1` e `.github/workflows/cartorig-1.2.3-full-offline-windows.yml`.

**Não afirmar que o instalador está homologado em Windows antes de executar essa etapa.** A distribuição aqui fornecida é um conjunto completo de dados + código e executáveis Windows compilados, com execução nativa Windows ainda pendente.

## Atualização — otimização de busca (16/11/2026)

Testes adicionais nesta compilação:

- `node tests/test_optimized_search.mjs`: **PASSOU**. Usa os dados mundiais oficiais, verifica nomes/aliases, identificação separada de São Paulo (cidade/estado), paginação completa e seleção espacial contra o predicado anterior em 220 enquadramentos, incluindo os dois lados do antimeridiano.
- `node tests/benchmark_geo_search.mjs`: benchmark com 15 consultas por termo e sem reaproveitar o cache de resultados. Busca mediana inferior a 5 ms nos termos avaliados (hardware de teste Linux/Node).
- `python tests/test_world_real_embedded_browser.py`: **PASSOU**. Verifica campo vazio, 20 resultados por página, “Mostrar mais”, pesquisa internacional, estilos independentes, PNG transparente e persistência usando os **4.596/7.342 dados reais**. O transporte HTTP é simulado porque o navegador do ambiente não consegue abrir 127.0.0.1.
- `python tests/test_br_states_e2e.py`, `python tests/test_123_alias_city_e2e.py`, `python tests/test_world_admin1_e2e.py`, `python tests/test_m1_regressions.py`: testes de regressão **PASSARAM**.

**Nota:** os dois arquivos GeoJSON completos e suas assinaturas SHA-256 são idênticos aos da entrega anterior. As otimizações não removem geometrias e não alteram a compatibilidade dos projetos. A homologação nativa Windows continua pendente.
