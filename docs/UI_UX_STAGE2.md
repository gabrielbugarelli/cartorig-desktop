# CartoRig Desktop — UI/UX Etapa 2

Base estável: [v2.1.0](https://github.com/gabrielbugarelli/cartorig-desktop/releases/tag/v2.1.0). O desenvolvimento da Etapa 2 ocorre somente em `feature/ui-ux-stage2`, sem alterar a tag ou a release anterior.

## Entrega 2.1 — Workspace ajustável

**Objetivo:** permitir redimensionar separadamente Scene/Geography e Inspector/Looks sem perder a área do mapa, objetos selecionados nem preferências ao trocar de abas.

### Comportamento

- Duas divisórias verticais nos limites do canvas, disponíveis em desktops com largura **acima de 980px**. Arraste cada divisória horizontalmente para ajustar somente o seu painel.
- **Acessibilidade:** foco por Tab; setas esquerda/direita para passos de 16px, Shift + seta para 32px, Home/End para limites mínimo/máximo. Clique duplo na divisória restaura a largura padrão individual.
- **File → Reset workspace layout** limpa a preferência salva, restaura as larguras originais e reabre ambos os painéis apenas no modo desktop.
- Larguras persistem localmente por dispositivo/usuário sob `cartorig.workspace.layout.v1` e **não** entram no projeto `.cartorig` nem no histórico de alterações da composição.
- Limites: esquerda **205–450px**, direita **245–520px**, com área central reservada de **pelo menos 420px** em desktop. A geometria preferida é mantida ao reduzir a janela; volta quando o espaço disponível permite.
- Em janelas de até **980px**, permanecem os drawers compactos existentes. As divisórias são ocultadas e não entram na navegação por teclado.
- Fechar e reabrir uma barra lateral preserva sua largura. Alternar Scene/Geography e Inspector/Looks não modifica a largura.
- Cancelar um arraste (Escape/cancelamento de ponteiro) restaura o estado anterior; somente o fim de uma interação válida persiste a largura.
- Os updates do grid alteram propriedades CSS, **não** criam novos renders de mapa. O `ResizeObserver` existente do canvas detecta a mudança de área e utiliza o scheduler coalescido de prévia.

### Arquivos e regressões

- `assets/workspace-layout.js`: cálculo dos limites, estado local, eventos Pointer e teclado, reset e API para navegação.
- `assets/navigation-ui.js`, `assets/index.html`, `assets/ux-layout.css`: integração no workspace atual sem mudar as ferramentas cartográficas.
- `tests/module_loader.py`: bridge de testes offline suporta o novo módulo.
- `tests/test_ui_stage2_workspace.mjs`: limites em 981/1024/1100/1366/1920/2560, foco, ponteiro, teclado, persistência, modo compacto, reset e `ResizeObserver` preservado.
- Teste adicionado ao build manual padrão Windows x64, no runner gratuito `windows-2022`, repositório público, retenção de 3 dias.

### Verificação manual no Windows

1. Abrir v2.1.0 para referência; abrir o portable da Etapa 2.1 em 1920×1080 e redimensionar cada painel, verificando que o mapa ocupa o espaço restante.
2. Abrir Scene e Geography, depois Inspector e Looks; conferir que as larguras continuam escolhidas e nenhum objeto perde seleção.
3. Fechar e reabrir as laterais. Reduzir a janela para 1366×768; a área central deve continuar usável. Reduzir para menos de 981px: divisórias desaparecem e os drawers compactos continuam funcionando.
4. Arrastar a borda, salvar a preferência, fechar e reabrir o aplicativo; conferir persistência. Alterar a resolução de janela e restaurar: a preferência original deve voltar.
5. Usar teclado para redimensionar, clique duplo para restaurar apenas um painel e **File → Reset workspace layout** para restaurar ambos.
6. Durante os passos, navegar, fazer zoom e mover o mapa; conferir que a câmera, as texturas, os Callouts e os exports continuam corretos.
7. Abrir um `.cartorig` antigo e verificar que não há alteração do schema nem do histórico Undo/Redo devido ao redimensionamento.

### Restrições e próximos passos

Esta entrega **não** altera a release v2.1.0, o motor de desenho, a renderização de texturas, arquivos de projeto, o formato de exportação nem o mecanismo nativo de salvamento. A Entrega 2.2 é desenvolvida na mesma branch e está descrita abaixo, sem mesclar na main antes da avaliação visual.

## Entrega 2.2 — Inspector contextual

O painel Inspector organiza os comandos existentes em quatro seções, escolhidas segundo o objeto selecionado:

- **Basic:** nome, visibilidade e bloqueio; para Labels e Callouts, conteúdo de texto e edição inline; para Routes, tipo de caminho; para Markers, escolha do símbolo.
- **Position:** posição WGS84, ancoragem geográfica/tela, offsets e alças de edição. Em Callouts, modo **Text box follows → Map / Screen**. Em Regions, origem e limites geográficos.
- **Appearance:** campos de alteração imediata do aspecto visual: cores de texto, caixa, preenchimento, contorno, espessura, tipografia, setas, dimensão dos símbolos e opacidade.
- **Advanced:** vértices, waypoints, importação de SVG/PNG, troca de fonte geográfica, sombra, brilho, mistura e overrides finos de estilo.

A navegação é feita por clique ou teclado (Tab, setas, Home e End), com atributos ARIA e abas vazias ocultadas. A seção selecionada permanece ativa enquanto as propriedades do objeto são alteradas, mas a seleção de outro objeto volta para Basic.

O conteúdo dos Inspectors de Route/Marker/Label/Shape foi redistribuído sem trocar os comandos `SetProperty`, `SetObjectStyle`, `SetProperties` e Undo/Redo. Uma Region agora expõe seus controles essenciais de cor e largura de contorno sem abrir Advanced. O painel avançado não duplica os campos de cores principais. Seleções múltiplas têm Basic e Appearance, sem oferecer operações incompatíveis.

**Compatibilidade:** UI apenas; não modifica a câmera, o schema 2.0.0, os exportadores, o cache de texturas, o desenho geográfico nem as preferências locais do Workspace da Etapa 2.1. A interface indica `2.2.0 Preview` para não ser confundida com a versão publicada `v2.1.0`.

**Regressões:** `tests/test_ui_stage2_inspector.mjs` cobre navegação, associação dos controles a cada seção, comandos de edição e Undo/Redo; o pipeline Windows também valida a sintaxe dos módulos e as regressões anteriores. Ver o [Changelog Etapa 2.2](CHANGELOG-stage2.2.md).

**Aceitação visual:** selecionar um Callout, trocar texto em Basic, cor em Appearance e âncora em Position; confirmar que o texto permanece legível. Repetir com Label, Route, Marker e Region, incluindo Undo/Redo e a edição em barra lateral reduzida. Testar em 1366×768 e 1920×1080.
