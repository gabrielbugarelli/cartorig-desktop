# CartoRig 1.4.4 — Scene Looks thumbnail flicker hotfix

## Defeito reproduzido em 1.4.3

Ao selecionar sucessivamente qualquer look, `style-studio.js` destruía e reconstruía nove cartões de Scene Looks. Esses cartões voltavam ao gradiente CSS antes de `app.js` regenerar todas as miniaturas com `renderScene()` e `toDataURL()`, após um timeout de 120 ms. O resultado era um piscar visível dos cartões e picos desnecessários de uso da thread de interface.

## Correção 1.4.4

- Os **mesmos nove elementos DOM** do grid de presets são preservados entre atualizações; somente a seleção `active` e `aria-pressed` é atualizada.
- Os bitmaps dos presets ficam armazenados em cache por definição efetiva do look e estado de carregamento das texturas offline; alternar look ou selecionar uma camada não invalida todas as prévias.
- O renderizador processa **uma** miniatura de 144×81 por quadro de animação, evitando a regeneração síncrona das nove.
- Uma definição alterada gera nova chave e invalidação seletiva; entradas antigas não são apagadas visualmente até a substituição estar pronta.
- Foi corrigida a inicialização do agendamento, para não depender do carregamento da imagem do mapa após `appReady=true`.
- Foco do teclado nos cartões e posição de rolagem são mantidos entre alterações.

## Verificação

`python tests/test_144_scene_look_flicker.py` espera o carregamento das nove prévias, alterna 12 vezes, confirma identidade de cada cartão, ausência de gradiente/flicker, preservação de `backgroundImage`, ausência de novas chamadas de `toDataURL()` e foco acessível. Todos os testes preexistentes Go, JS e browser continuam obrigatórios no pipeline Windows.

## Limite de homologação

Compilação cruzada gera PE32+ Windows x64, mas não confirma instalação, inicialização ou compatibilidade em Windows real. Esses testes só são homologados quando executados em runner ou máquina Windows, inclusive teste offline.
