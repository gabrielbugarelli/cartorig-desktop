# CartoRig Desktop 2.4.0 Preview — Etapa 2.4

**Base:** release estável [v2.2.0](https://github.com/gabrielbugarelli/cartorig-desktop/releases/tag/v2.2.0).  
**Branch:** `feature/ui-ux-stage24`, baseada na Etapa 2.3 ainda não integrada.  
**Escopo:** Looks e ajustes visuais simplificados. Esta é uma prévia cumulativa das Etapas 2.3 + 2.4, **não é uma release estável**.

## Implementado

- **Personalize → Quick adjustments:** a seção de trabalho mais frequente está sempre visível com o bloco **MAP DISPLAY**, os checkboxes independentes **Land textures** e **Ocean textures**, intensidades terrestre/oceânica e de relevo, cores principais da terra e do oceano e controles de **MAP LABELS**.
- **Personalize → Advanced customization:** agrupa as configurações técnicas em um painel recolhido por padrão, preservando materiais separados de terra e oceano, fontes de raster geográfico, relevo detalhado, ajustes de atmosfera, tipografia e padrões por categoria de objeto.
- **Sem duplicação:** uma mesma intensidade/cor principal é editada apenas em Quick adjustments. O editor avançado mantém os demais campos existentes e seus limites; não acrescenta campos ao formato de projeto.
- **Status visível em cada parâmetro:** `inherited` (padrão do Look), `customized` (sobrescrita do projeto) e `disabled` (superfície sem texturas). Controles de intensidade da superfície desativada ficam inativos, mas seu valor é preservado.
- **Restore look default** aparece por campo quando ele foi personalizado; remove somente a sobrescrita correspondente, sem restaurar toda a cena, e é reversível via Undo/Redo.
- **Galeria de 36 Looks:** as imagens PNG originais permanecem imutáveis; cada cartão agora exibe a família de estilo e o Look selecionado indica quantos ajustes foram personalizados. Filtros e busca continuam funcionando.
- **Rótulos e estilos:** controles globais continuam em Looks, enquanto aparência de objetos específicos permanece no Inspector. Alternar Look não muda as preferências independentes de texturas terrestres e oceânicas.
- **Responsividade:** layouts compactos, controle por teclado dos sliders e foco acessível permanecem disponíveis na sidebar redimensionável.

## Compatibilidade preservada

- Schema `.cartorig` **2.0.0**, projetos antigos e comandos existentes `SetThemeProperty`, `SetSurfaceTextureVisibility` e `SetMapLabelOption`.
- Undo/Redo, exportações PNG/SVG/ZIP, Cache, zoom, rotação, Callouts e a renderização das superfícies geográficas.
- Todas as funções da Etapa 2.3: prévia de Marker/Label/Route/Shape, orientação dos cliques e alças semânticas.
- O workflow Windows padrão continua `workflow_dispatch` e usa runner gratuito `windows-2022`, repositório público e retenção curta de 3 dias.
- A tag e a release `v2.2.0` não são alteradas. Etapa 2.3 ainda aguarda homologação visual e a 2.4 é entregue na mesma condição.

## QA

- `tests/test_ui_stage24_looks.mjs` simula a interface real de Looks com o SceneStore: valida 36 cartões, estados de propriedades, campos Quick vs Advanced, texturas independentes, troca de Look, Undo/Redo, persistência e reset por parâmetro.
- `tests/test_ui_map_display.mjs` e `tests/test_202_ux_revision.py` atualizados para a nova hierarquia.
- Regressões anteriores de textura, Callout, Inspector, Workspace e Etapa 2.3 são mantidas no build Windows portable.

### Checklist de aceitação visual

1. Em **Looks → Personalize**, verificar que **Quick adjustments** aparece imediatamente. Desmarcar Ocean textures mantendo Land textures; terra continua texturizada e o mar perde a textura.
2. Alterar Ocean texture intensity e Land texture intensity individualmente. Verificar valores e rótulos de estado; reverter um campo com Restore look default e conferir Undo/Redo.
3. Expandir Advanced customization, escolher material terrestre e oceânico, consultar Geographic raster over ocean e confirmar que cada material é aplicado somente à superfície correta.
4. Alternar Atlas e outro Look entre os 36 cartões; verificar as miniaturas, filtros, família, rótulo Customized e preservação dos checkboxes de terra/oceano.
5. Salvar/reabrir `.cartorig`, redimensionar a sidebar e exportar PNG/SVG/ZIP. Verificar que a composição e os ajustes persistem.

As diferenças visuais reais no WebView2 ainda precisam ser aprovadas pelo usuário antes de integração à `main`.
