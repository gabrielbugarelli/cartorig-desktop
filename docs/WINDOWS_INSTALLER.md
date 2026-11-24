# Instalador Windows — CartoRig 2.4.0 Preview

## Objetivo

Instalador tradicional **Windows x64** em `.exe`, diferente do portable. Utiliza **Inno Setup 6** e inclui:

- Assistente de instalação em português brasileiro ou inglês.
- Instalação para o usuário atual, **sem exigir administrador**: `%LOCALAPPDATA%\Programs\CartoRig Desktop`.
- Atalho no menu Iniciar e opção de criar atalho na área de trabalho.
- Registro em **Configurações → Aplicativos → Aplicativos instalados**, com desinstalador `unins000.exe`.
- Opção de iniciar o CartoRig ao final do assistente.
- O app instalado é `CartoRig.exe` (mesmo binário aprovado na Etapa 2.4, renomeado apenas no destino).
- Instalador e executável de aplicação independentes do projeto `.cartorig` e dos arquivos de usuário.

**Preservação de dados:** desinstalar remove binários, atalhos e a entrada de desinstalação, mas **não remove projetos, recuperações nem preferências** guardadas na pasta `%LOCALAPPDATA%\CartoRig`. O usuário mantém seu trabalho ao reinstalar.

## Antes da instalação

- Windows 10/11 **64 bits**, Microsoft Edge WebView2 Runtime disponível.
- Se o CartoRig estiver aberto na bandeja do sistema, feche-o antes de atualizar ou desinstalar.
- A prévia 2.4.0 **não possui certificado Authenticode**. O instalador também não está assinado e **pode acionar o Microsoft Defender SmartScreen**. Não é uma correção de reputação ou assinatura. Veja [orientações de segurança](WINDOWS_CODE_SIGNING.md).

## Instalar e remover

1. Baixe `CartoRig-2.4.0-Preview-Setup-Windows-x64.exe` do artefato de QA da Etapa 2.4.
2. Compare o SHA-256 publicado para o instalador com `Get-FileHash .\CartoRig-2.4.0-Preview-Setup-Windows-x64.exe -Algorithm SHA256`.
3. Execute o instalador e siga o assistente. Escolha se deseja um atalho na área de trabalho.
4. Inicie o CartoRig pelo **menu Iniciar → CartoRig Desktop**.
5. Para remover, abra **Configurações → Aplicativos instalados → CartoRig Desktop (2.4.0 Preview) → Desinstalar**.

Não é necessário extrair um ZIP nem copiar arquivos manualmente: o assistente instala e registra o aplicativo.

## Verificação de instalação automatizada

A Action temporária de QA no runner público `windows-2022` usa o EXE da execução de aprovação `45314770326`, com SHA-256 fixo:

`89714c33f271cacc2a2c53bc9cfc338aff331f55d747d0925dfde838412bcd50`

A suíte verifica:
- hash do arquivo original antes de empacotar;
- compilação do instalador Inno Setup;
- instalação silenciosa no perfil de teste;
- `CartoRig.exe` com mesmo SHA-256 do portable aprovado;
- criação do desinstalador e dos atalhos no menu Iniciar;
- registro de aplicativo instalado no Windows;
- `--self-check` e inicialização GUI pelo caminho instalado;
- desinstalação real, remoção de binários e atalhos e preservação de dados do usuário.

A instalação normal usa interface visual; somente o teste CI utiliza modo silencioso. A tag estável `v2.2.0` e a `main` não são alteradas por esta prévia.
