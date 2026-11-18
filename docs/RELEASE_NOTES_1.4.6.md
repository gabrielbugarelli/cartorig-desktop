# CartoRig 1.4.6 — Scene Looks Reference Collection

## Conteúdo

- 27 cenas visuais inspiradas individualmente nas 27 imagens de `maps.zip`, junto dos 9 temas originais: **36 presets**.
- 36 miniaturas PNG estáticas produzidas pelo renderizador real, incorporadas ao executável Windows x64 e usadas sem imagens provisórias na inicialização.
- Pesquisa por nome/descrição, filtros Original (9), Reference Collection (27) e famílias estilísticas.
- `land_tint_color` e `land_tint_strength` (0..1): tonalização opcional exclusivamente das massas terrestres do mapa-base. Não altera cores explícitas de Regions nem preenche o oceano.
- Mantém dados mundiais offline (Admin 1 4.596 feições e Populated Places 7.342), Scene Graph, Undo/Redo, exportação, 1.3 Creative Tools e 1.4 Cinematic Styles.

## Fidelidade às referências

As imagens foram analisadas visualmente uma por uma em `docs/SCENE_LOOKS_REFERENCE_AUDIT.md`. Cada nova entrada é uma **receita de aparência funcional**, com paleta, textura instalada, relevo e atmosfera. Os mapas originais NÃO são raster georreferenciado e não foram inseridos como fundo falso. Elementos como navios, arte de fantasia, fronteiras históricas, personagens, rótulos, contornos batimétricos e brasões não são criados automaticamente pelo preset. Para reproduzi-los são necessários overlays/objetos editoriais ou dados geográficos adicionais.

A referência nº 19 é uma imagem quase uniformemente preta, sem mapa legível. O look `Obsidian Minimal` é uma interpretação minimalista explícita dessa imagem, não um mapa extraído dela.

## Segurança, qualidade e limites

- Presets não introduzem JavaScript carregado de imagens nem dependências externas.
- Há hashes SHA-256 para as miniaturas e fontes de renderização; a compilação verifica integridade no Go.
- Os testes de navegador em páginas novas verificam 36 miniaturas, filtros e seleção sem substituição de cartões; em Windows o CI também executa recarga HTTP/F5.
- Compilação cruzada Windows não é homologação de instalação/execução em Windows real.
