# CartoRig 2.0.2 — UI Cleanup R3

Revisão de interface baseada na auditoria de 27 pontos. Mantidos os modelos de cena, os motores de renderização, os 36 looks, a pesquisa geográfica e as exportações.

## Mudanças
- Removidos cards de ajuda e títulos repetidos em Scene, Inspector, Looks e canvas.
- O nome do projeto passa a ter um único campo de edição no cabeçalho.
- Ações de grupo consolidadas no comando existente: selecionado = agrupar; sem seleção = grupo vazio.
- Enquadramento da seleção concentrado na barra do canvas e atalho F.
- Ações de região padrão utilizam Scene; troca de geografia permanece no Inspector, recolhida.
- IDs de objeto e metadados geográficos ficam em detalhes recolhíveis, avisos de geometria não resolvida permanecem visíveis.
- Controles desabilitados de Rivers/Lakes/Coastlines ocultos até que haja dados disponíveis.
- Textos explicativos permanentes removidos de materiais, relevo, textura, defaults, grupos, editor de desenhos, projetos e exportação.
- Export Studio apresenta apenas erros/avisos de preflight; detalhes técnicos sob demanda.
- Exportação `.cartorig` permanece disponível no menu File, via Save as .cartorig, e Project Manager.
- Ações avançadas, Undo/Redo, efeitos, dados geográficos e modos de exportação visual continuam acessíveis.

## Homologação
Teste automatizado em Chromium e Go no ambiente Linux; executáveis Windows x64 compilados via cross-compilation. Teste em Windows nativo permanece necessário.
