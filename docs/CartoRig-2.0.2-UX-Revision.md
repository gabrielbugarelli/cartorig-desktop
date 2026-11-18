# CartoRig 2.0.2 — revisão de organização da interface

## Decisão de arquitetura (antes de implementar)
- **Looks**: a seleção atual já é marcada na galeria; um cartão de estado com botão Personalize duplicava a aba Personalize. O cartão inteiro foi retirado.
- **Geography**: apresentação de SHA-256, verificação de bundles e URLs de origem não são tarefas cotidianas do editor. As verificações continuam no serviço Go e nos testes de distribuição, mas seus painéis foram removidos. A importação GeoJSON foi mantida em ação compacta e separada.
- **Export**: parâmetros `doc.canvas` (padrões de Quick PNG/ZIP e preview) são diferentes dos parâmetros de Export Studio, que valem somente para a exportação atual. Os primeiros foram transferidos para uma área de preferências de saída no Export Studio; os segundos continuam em primeiro plano. Não houve alteração de formato `.cartorig`.
- **Composição**: `show_state_boundaries`, `show_rivers`, `show_lakes`, `show_coastlines` são atributos visuais globais, assim como as cores e estilo de bordas, atmosfera, tipografia e defaults por tipo de objeto. Eles agora vêm antes do acabamento artístico. Controles duplicados de cor/largura de borda foram retirados — os do Style Studio já são vinculados ao CommandBus.

## Conteúdo alterado
- `assets/index.html`: reorganização dos controles e remoção das seções de diagnósticos.
- `assets/style-studio.js`: remoção de cartão redundante e reordenação das configurações globais.
- `assets/app.js`: retirada de referências a painéis excluídos e preservação de importação e renderização.
- `assets/ux-layout.css`: hierarquia visual dos ajustes e ajustes da Geography.
- `tests/test_202_ux_refinement.py`, `tests/test_202_ux_revision.py`: critérios de regressão.

## Não alterado
Renderizador, geometrias, motor de criação, estilo/efeitos, datasets Natural Earth oficiais, esquema de projetos e contrato do Export Studio.

## Limitações
Os executáveis Windows são compilados em Linux; a instalação/execução nativa em Windows ainda precisa de homologação.
