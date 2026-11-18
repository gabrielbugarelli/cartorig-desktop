# CartoRig 2.0 — Production (candidata à homologação)

CartoRig 2.0 preserva o editor offline Go + HTML/CSS/JavaScript/Canvas2D da 1.4.7: 36 Scene Looks, 21 materiais, as 4.596 subdivisões Admin 1, as 7.342 cidades, pesquisa multilíngue, rotas, marcadores, textos, desenhos, herança, Shadow/Glow e composições transparentes.

## Funcionalidades introduzidas

- **Project Manager:** Save no armazenamento local via backend Go, Save As com download de pacote `.cartorig` ZIP, validação antes de abrir, gravação temporária e substituição atômica com backup, autosave por revisão com debounce, restauração como cópia, projetos recentes, cinco modelos de projeto e templates próprios.
- **Export Studio:** seleção de escopo, PNG final, PNG transparente, ZIP em camadas por objeto/grupo/categoria, PNG de fundo, máscara geográfica branca/transparente ou preto/branco, SVG vetorial básico, presets de exportação reversíveis, preflight e cancelamento.
- **Exportação incremental:** PNGs transmitidos um a um ao backend Go. Modo de tiles 1024 px com overscan para efeitos e recomposição num PNG completo; ZIP gerado incrementalmente para reduzir memória ocupada por múltiplas camadas.
- **Segurança:** autenticação com token local, validação de Origin/Host, dimensões e tipo real de imagens, sanitização SVG, limites de arquivos e extração ZIP protegida.
- **Compatibilidade:** mantém abertura de arquivos `.mapcomposer.json` V1 e documentos JSON CartoRig antigos. Arquivos `.cartorig` 2.0 são pacotes ZIP contendo projeto JSON e metadados de integridade.

## Como usar

1. Abra o aplicativo e componha uma cena offline.
2. Clique **Save** para salvar no repositório local do CartoRig ou **Projects → Save and download .cartorig** para uma cópia portátil.
3. Em **Projects**, use os cinco templates, a lista de projetos recentes ou a recuperação de autosave.
4. Clique **Export Studio**, selecione modo, objetos, resolução e eventuais máscaras; confira preflight e exporte o ZIP.
5. Importe PNGs de mesmo tamanho no seu editor de vídeo, sem modificar centro nem escala.

## Testes executados no ambiente Linux

- `go test -tags fullgeo ./...` — aprovado.
- `node tests/test_world_real.mjs` — 4.596 Admin1 + 7.342 cidades aprovados.
- `node tests/test_13_creative_geometry.mjs` — 94 referências geodésicas aprovadas.
- `node tests/test_147_material_catalog.mjs` — 36 presets/21 materiais aprovados.
- `node tests/test_20_production_contracts.mjs` — templates, presets Undo/Redo e SVG de Region aprovados.
- `python tests/test_13_creative_e2e.py` e `python tests/test_14_style_e2e.py` — fluxos de criação, edição, PNG, Save/Open e estilos aprovados com servidor simulado; backend ZIP testado separadamente.
- `python tests/test_20_http_e2e.py --executable ...` — API Go local real: Save/Open, autosave, recovery, pacote ZIP, cancelamento aprovados.
- `python tests/test_20_production_ui.py` — Chromium: Export Studio, PNG e sessões de exportação aprovados usando respostas HTTP de teste.
- `python tests/test_20_tiles_browser.py` — diferença em 3.231 de 1.440.000 canais (~0,224%) no teste de tiles; pequenas diferenças antialiasing e 192 diferenças em áreas de borda, dentro da tolerância do teste. **Ainda não há prova de correspondência pixel a pixel.**
- `python tests/test_14_style_pixels.py`, `python tests/test_147_material_pixels.py` — Shadow/Glow, grupos, máscaras e materiais aprovados.

## Pendências reais de homologação (não declarar como aprovadas)

- Execução/instalação/atualização/desinstalação do instalador em Windows 10 e 11, incluindo F5 e fluxo de navegador nativo; workflow Windows foi incluído, mas não executado nesta sessão.
- Importação e recomposição dos arquivos PNG em DaVinci Resolve ou outro editor de vídeo real.
- Testes prolongados de 30 exportações sequenciais e medição de RAM/tempo nos três perfis de hardware do documento CR-SPEC-2.0; exportação 8K em máquina Windows real não homologada.
- Exportação SVG é **básica**: elementos não representáveis e efeitos avançados são omitidos com aviso; não é SVG de alta fidelidade universal.
- A interface de recovery usa confirmação simples (Recover Copy ou Keep Current); ainda não oferece painel completo de três opções com prévia e descarte. Migrações v2.x avançadas e assets externos em pacotes separados exigem homologação adicional.
- Algumas pequenas diferenças de pixels entre saída tiled e full-frame foram observadas; não se deve afirmar identidade absoluta.

A versão é uma **candidata à homologação 2.0**, não uma prova de conformidade integral de AT-001 a AT-072 ou de G5 Windows.
