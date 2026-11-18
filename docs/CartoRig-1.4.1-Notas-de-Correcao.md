# CartoRig 1.4.1 — Correção de descoberta dos estilos e alfa

## Problemas constatados na entrega 1.4.0

A interface abria com `Inspector`, ocultava `Style Studio` dentro de `Styles & Output` e exibia sete temas legados antes dos novos controles. No Inspector, os atalhos de efeitos também ficavam abaixo das operações de identidade e geografia. A implementação de atmosfera utilizava uma camada preenchida que podia introduzir alfa no exterior de objetos transparentes. O instalador sobrescrevia o executável diretamente, gerando erro genérico quando a versão anterior estava aberta.

## Mudanças reais no 1.4.1

- `Style Studio` abre visível por padrão e tem acesso direto na barra superior.
- Os nove presets oficiais aparecem em uma única galeria com prévias geradas pelo renderizador.
- Atalhos funcionais `Cinematic Glow`, `Soft Shadow` e `Clear Effects` para o objeto selecionado.
- `Inspector` apresenta os botões de Glow, Shadow e acesso a configurações avançadas antes dos controles antigos.
- A composição de tint/vignette usa `source-atop`, preservando o alfa original quando o fundo é transparente.
- O instalador informa explicitamente que é necessário fechar a instância anterior se a substituição do executável falhar.
- O pacote inclui teste automatizado `tests/test_141_visibility.py` que verifica a visibilidade inicial do painel, nove presets, Glow no Inspector e não alteração de alfa em pixels transparentes.

## Uso e verificação

1. Feche completamente a instância anterior do CartoRig e a aba local do navegador.
2. Instale a 1.4.1 ou execute a versão portátil nova.
3. Confira o cabeçalho `1.4.1 CINEMATIC STYLES`; o `Style Studio` deve estar aberto.
4. Adicione um país, clique nele na lista de camadas e use `Glow` ou `Shadow` no início do Inspector.
5. Para verificar o processo realmente iniciado, a URL local do CartoRig possui o endpoint `/api/health`, que retorna a versão exata (`1.4.1`).

## Limites

Os dados naturais do 1.4 e as ferramentas da 1.3 permanecem incluídos. Esta é uma correção de interface e composição de alfa, não a homologação de funcionalidades restantes da especificação 2.0. O instalador e a interface ainda não foram executados em um sistema Windows real neste ambiente; os testes de navegador foram feitos em Chromium para Linux e a compilação Windows foi cruzada.
