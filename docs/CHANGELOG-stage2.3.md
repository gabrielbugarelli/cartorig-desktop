# CartoRig Desktop 2.3.0 Preview — Changelog Etapa 2.3

**Base estável:** [v2.2.0](https://github.com/gabrielbugarelli/cartorig-desktop/releases/tag/v2.2.0)  
**Branch:** `feature/ui-ux-stage23` — não é uma release e não altera a `main`.

## Adicionado

- Feedback contextual e não bloqueante sobre cada etapa de criação no mapa, com o próximo clique e atalhos relevantes. A informação é exposta a leitores de tela por `aria-live=polite`.
- Prévia **Marker** antes do primeiro clique, respeitando o símbolo escolhido, e prévia **Label** com a posição do texto antes de abrir o editor inline.
- Prévia de Routes, Shapes, Callouts e Distances durante a criação, com âncoras e vértices temporários destacados. O cursor e a geometria têm prioridade sobre alvos existentes sem modificar a cena antes de concluir.
- Guias separados para o primeiro clique, segundo clique, múltiplos vértices e edição de alças. Os Callouts exibem distintamente a âncora geográfica e a caixa que seguirá o mapa.
- Identidade visual para os tipos de controle: âncoras circulares âmbar, vértices quadrados azuis, waypoints menores e caixas/offsets em losango verde. Área de interação ampliada para 18 pixels no espaço interno do canvas.
- Destaque ao passar o cursor sobre a alça e durante a alteração, incluindo cursor de arraste.

## Aperfeiçoado

- **Enter** conclui Polygon e Custom Route quando houver vértices suficientes; **duplo clique** conclui a mesma operação e evita adicionar um ponto final duplicado.
- **Backspace** remove somente o último ponto do desenho inacabado. Não exclui objetos selecionados enquanto um rascunho está ativo.
- **Esc** cancela a operação de desenho/edição e volta a Select, sem comprometer Undo/Redo.
- **Ctrl+Enter** permanece reservado ao editor inline de Label. O cancelamento do editor não gera objeto.
- Trocar tipo de Route, Shape ou modo WGS84/Screen descarta explicitamente o rascunho anterior, evitando misturar geometria.
- Pontos inválidos ou coincidentes não finalizam Route/Shape de dois pontos. O aplicativo preserva a origem para tentar novamente, sem criar objetos inválidos.
- Prévia temporária de Marker/Label some quando o cursor sai da área do mapa ou abre o editor de texto.
- Desenhos Freehand não renderizam milhares de alças intermediárias; o rascunho permanece leve durante o arraste.
- Todo novo Callout continua usando **dois pontos geográficos**; Callouts legados com caixa fixa na tela permanecem compatíveis.

## Não alterado

- Schema `2.0.0` e projetos `.cartorig` existentes.
- Texturas terrestres e oceânicas independentes; câmera e renderização cartográfica.
- Workspace ajustável da Etapa 2.1 e Inspector contextual da Etapa 2.2.
- Undo/Redo dos comandos concluídos e exportações PNG, SVG e ZIP.
- Release estável `v2.2.0` e branch `main`.

## Regressão e aceitação

O teste `tests/test_ui_stage23_drawing.mjs` valida prévia Marker/Label, orientação por ferramenta, distinção e hit-testing de alças, deduplicação de vértices, criação real de Callout/Polygon/Custom Route e uma entrada de Undo por objeto concluído. Faz parte dos testes de build Windows Wails3 e da inicialização do programa.

**Checklist visual Windows:** criar Marker e Label observando a prévia; Route simples e Custom com Enter/duplo clique; Polygon com Backspace; Rectangle/Ellipse/Arrow/Distance/Freehand; Callout com dois pontos; mover alças de posições em zoom e rotação diferentes; testar Esc e desfazer/refazer. Confirmar que alterações na tela não modificam projetos antes de finalizar.

**Escopo:** Etapa 2.4 (Looks simplificados) não está incluída neste build.
