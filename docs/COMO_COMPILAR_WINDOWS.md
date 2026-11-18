# CartoRig 1.2.3 — Compilação reproduzível e homologação nativa

O ZIP-fonte distribuído inclui ambos os datasets mundiais 1:10m oficiais e seus hashes. Não é necessário qualquer download de geodados para compilar o aplicativo.

Requer Go 1.23+; Node.js 22; Windows 10/11 x64; PowerShell 7; Python 3.11+ com `playwright` e `pillow`; Playwright Chromium instalado.

```powershell
python tools/prepare_offline_datasets.py --verify-only
go test -tags fullgeo ./...
node tests/test_world_real.mjs
python -m pip install playwright pillow
python -m playwright install chromium
./scripts/build-windows.ps1
```

O script usa datasets embutidos existentes, confere SHA e contagem, compila um EXE console para os testes HTTP, testa a interface em Chromium no Windows sem acesso à Internet durante as operações, gera instalador e portátil, instala e verifica no registro local, empacota código-fonte completo e gera hashes SHA256.

O workflow `.github/workflows/cartorig-1.4.6-full-offline-windows.yml` permite fazer esse processo em um runner Windows 2022 quando o código for colocado em um repositório GitHub com GitHub Actions ativo. Se qualquer teste falhar, **não** publica o instalador como release verificada.
