# Assinatura de executáveis Windows — CartoRig

## Diagnóstico do aviso SmartScreen

O Windows exibiu **"O Windows protegeu o computador" / "Fornecedor desconhecido"** ao executar um portable. O motivo confirmado é que os executáveis Windows das prévias atuais **não possuem assinatura Authenticode**: não existe identidade criptográfica do editor associada ao arquivo.

**Não é um defeito do Wails3 nem um erro da inicialização do CartoRig.** Um hash SHA-256 comprova integridade em relação a um hash publicado, mas **não comprova a identidade do fabricante**. Alterar nome, ícone, recursos de versão, extrair o ZIP ou criar um certificado autoassinado não estabelece confiança pública no SmartScreen. Não devemos desativar SmartScreen ou instruir usuários a adicionarem um certificado autoassinado às raízes confiáveis.

As capturas fornecidas pelo usuário mostram a versão **2.3.0 Preview**; a prévia mais recente da Etapa 2.4 é **2.4.0 Preview**. Ambas precisam de assinatura confiável para resolver "Fornecedor desconhecido".

## Caminho sem custo de certificado: SignPath Foundation

O CartoRig é um projeto público com licença **MIT**. Isso permite **solicitar avaliação**, mas **não garante aprovação**, no programa SignPath Foundation para software livre:

- [SignPath Foundation — candidatura](https://signpath.org/)
- [Termos e critérios](https://signpath.org/terms)
- [Integração oficial com GitHub](https://docs.signpath.io/trusted-build-systems/github)

O mantenedor precisa:
1. Solicitar a participação da fundação com o repositório público `gabrielbugarelli/cartorig-desktop` e a página das releases.
2. Satisfazer os requisitos do programa, incluindo projeto já publicado, origem verificável, licenças de dependências, MFA, política de assinatura, responsáveis e revisão manual das assinaturas.
3. Após aprovação, criar no SignPath um projeto, uma configuração de artefato que selecione e assine o EXE dentro do ZIP de artefatos do GitHub, e uma política de assinatura que exija aprovação do responsável.
4. Configurar no **GitHub → Settings → Secrets and variables → Actions**:
   - Secret `SIGNPATH_API_TOKEN`: token de envio emitido pelo SignPath.
   - Variable `SIGNPATH_ORGANIZATION_ID`: ID da organização SignPath.
   - Variable `SIGNPATH_PROJECT_SLUG`: identificador do projeto.
   - Variable `SIGNPATH_SIGNING_POLICY_SLUG`: identificador da política de assinatura.
5. Executar manualmente a Action **CartoRig Signed Windows Portable (SignPath OSS)** a partir da branch revisada.

O workflow `.github/workflows/cartorig-windows-signpath-signed.yml`:
- Só opera em repositório público e refs explicitamente aceitas (`main` e a branch de desenvolvimento atual), em runner gratuito `windows-2022`.
- **Falha antes de compilar se faltar configuração**; não gera saída assinada falsamente.
- Compila no runner GitHub, verifica a origem do build, envia somente o EXE via artefato para a assinatura gerenciada da fundação.
- Aguarda aprovação/assinatura, baixa o EXE assinado e verifica a cadeia Authenticode com `scripts/verify-windows-signature.ps1`.
- Recalcula SHA-256 **após** a assinatura (a assinatura altera os bytes do EXE), cria o ZIP assinado e publica o artefato explicitamente chamado `SIGNED`.
- Se faltar assinatura válida, certificado de finalidade Code Signing ou confiança Windows, **falha sem publicar um portable como assinado**.
- Não publica automaticamente nenhuma release estável ou altera a `main`.

**Importante:** a assinatura reduz a advertência "Fornecedor desconhecido", mas o SmartScreen pode manter "aplicativo não reconhecido" até o editor e a distribuição adquirirem reputação. A Microsoft não garante o desaparecimento imediato do aviso para um arquivo recém-assinado.

## Alternativas

- **Certificado Authenticode público OV**: obter de uma autoridade certificadora reconhecida e integrar o serviço de assinatura ou dispositivo HSM ao pipeline. Um certificado de produção não deve ser incluído no repositório, em artefatos ou código-fonte.
- **Microsoft Store em formato MSIX**: se aprovado na Store, o pacote é assinado pela Microsoft, reduzindo avisos de download da Store. Trata-se de outro canal de distribuição, não da correção do EXE portable baixado do GitHub.
- **Azure Artifact Signing**: depende de elegibilidade regional/organizacional, verificação de identidade e cobrança. Não é possível assumir que está disponível para qualquer desenvolvedor individual no Brasil.

Para detalhes oficiais sobre reputação e confiança:
- [Microsoft — SmartScreen Reputation](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
- [Microsoft — Code signing options](https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options)

## Teste local e segurança

Para inspecionar um EXE Windows:
```powershell
Get-AuthenticodeSignature -LiteralPath '.\CartoRig-2.4.0-Preview-Wails3-Portable-Windows-x64.exe' |
    Format-List Status,StatusMessage,SignerCertificate
```

Para exigir uma assinatura válida no pipeline Windows:
```powershell
.\scripts\verify-windows-signature.ps1 -ExePath '.\dist\signed\CartoRig-2.4.0-Preview-Wails3-Portable-Windows-x64.exe'
```

Antes de assinar, o comando deve falhar como **UNSIGNED EXECUTABLE**. O checksum existente comprova apenas que o EXE corresponde ao build publicado; não substitui a assinatura.

Para um arquivo já verificado e obtido do repositório oficial, o usuário pode optar conscientemente por **Mais informações → Executar assim mesmo**, sem desligar as proteções globais do Windows. Isso é uma decisão temporária do usuário, não a solução de distribuição. Nunca peça a usuários para desligarem o SmartScreen, o Defender ou a UAC.
