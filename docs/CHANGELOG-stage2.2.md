# Changelog — CartoRig Desktop 2.2.0 Preview

**Entrega:** UI/UX Etapa 2.2 — Inspector contextual  
**Base estável:** v2.1.0  
**Branch:** `feature/ui-ux-stage2`  
**Status:** prévia para validação; nenhuma alteração na release v2.1.0

## Adicionado

- **Inspector com navegação contextual** por quatro seções: **Basic**, **Position**, **Appearance** e **Advanced**. As seções são específicas do tipo de objeto selecionado, com campos importantes expostos primeiro.
- **Atalhos de teclado para o Inspector:** Tab para chegar às abas, setas esquerda/direita para mudar a seção, Home/End para primeira/última. A seleção ativa é preservada após editar uma propriedade; trocar de objeto volta a Basic.
- **Reorganização de Callout:** texto em Basic, âncora/caixa/posição em Position, texto/cor da caixa/traço em Appearance e edição detalhada de vértices em Advanced.
- **Reorganização de Label:** texto e edição inline em Basic, fontes, cores e tipografia em Appearance, modo geográfico/tela e deslocamentos em Position.
- **Reorganização de Route:** caminho em Basic, estilo de linha e setas em Appearance, coordenadas e alças em Position, waypoints e operações de rota em Advanced.
- **Reorganização de Marker:** ícones em Basic, tamanho e cores em Appearance, âncora e offsets em Position, importação e biblioteca de SVG/PNG em Advanced.
- **Regiões:** nome e visibilidade em Basic, geografia e limites WGS84 em Position, preenchimento e contorno em Appearance; substituição de geometria e efeitos em Advanced.
- **Seleção múltipla:** visibilidade em Basic, opacidade e cor compartilhada em Appearance.

## Melhorado

- Removidos os controles duplicados de preenchimento, contorno e cor de texto do Inspector avançado; propriedades de aparência básicas ficam na aba Appearance. Advanced continua oferecendo opacidade detalhada de traço, sombras, brilho e modo de mesclagem.
- O seletor de cor do Inspector criativo considera a cor efetiva herdada do tema quando não há sobrescrita explícita.
- Botões e abas do Inspector têm identificações acessíveis, estado selecionado e foco de teclado visível.
- Barra lateral do Inspector continua compatível com os painéis redimensionáveis introduzidos na Etapa 2.1.
- A interface desta branch aparece como **2.2.0 Preview** para diferenciá-la da v2.1.0 estável.

## Mantido sem alterações

- O formato de projeto `.cartorig` e o schema 2.0.0.
- Comandos de edição, Undo/Redo, seleção, bloqueio, visibilidade e Inspector de objetos.
- Callouts georreferenciados, texto legível e alternância de caixa fixa na tela ou ancorada ao mapa.
- Texturas terrestres e oceânicas independentes, preview, zoom, pan, rotação e exportações PNG/SVG/ZIP.
- Layout local dos painéis redimensionáveis da Etapa 2.1.
- Release estável **v2.1.0** e a branch `main`.

## Validação

- Teste `tests/test_ui_stage2_inspector.mjs`: navegação acessível por abas, organização contextual de Callout/Label/Route/Marker, edição de propriedades e Undo/Redo.
- Testes de sintaxe para `inspector-layout.js`, `creative-inspector.js` e `style-inspector.js`.
- Testes de regressão de projeto, texturas, Callout, UI/UX Etapa 2.1 e build portable Windows no GitHub Actions (runner público gratuito `windows-2022`).

**Ainda requer validação visual no Windows:** alternância entre seções do Inspector, edição real das propriedades, largura da sidebar em 1366×768 e reabertura de projetos antigos.

## Como testar

1. Abra o portable e selecione um Callout existente. Use **Basic** para alterar o texto e **Appearance** para conferir a cor; use **Position** para mudar o modo da caixa de texto.
2. Selecione um Label. Confira os controles de fonte, tamanho e cor em Appearance e os controles de localização em Position.
3. Selecione uma Route e um Marker para conferir setas, traços, âncoras e offsets.
4. Selecione uma Region e altere sua cor em Appearance, verificando o resultado no mapa e Undo/Redo.
5. Redimensione a barra direita e alterne Inspector/Looks. Confira a navegação por teclado, o estado dos campos e se a área do mapa permanece funcional.
