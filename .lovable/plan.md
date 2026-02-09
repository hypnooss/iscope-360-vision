

# Reverter PowerShell Executor para CertificateFilePath

## Diagnostico

A evidencia e clara:
- **TASCHIBRA-IDA** usa `CertificateFilePath` com EXO 3.9.2 e **funciona**
- **NEXTA-AAX** usa `-Certificate $cert` (a "correcao") com EXO 3.9.2 e **falha**

A correcao anterior (trocar `CertificateFilePath` por `-Certificate $cert`) foi baseada numa hipotese incorreta e e a **causa real** do erro `Split-Path`.

## Mudancas

### 1. Reverter `python-agent/agent/executors/powershell.py`

**Reverter os templates de conexao CBA para o formato original:**

- ExchangeOnline: voltar para `CertificateFilePath "{cert_path}" -CertificatePassword ([System.Security.SecureString]::new())`
- MicrosoftGraph: voltar para `CertificateFilePath "{cert_path}" -CertificatePassword ([System.Security.SecureString]::new())`

**Remover o bloco de carregamento do certificado em memoria** (linhas que criam `$cert` via `X509Certificate2`) adicionado no `_build_script`.

### 2. Incrementar versao em `python-agent/agent/version.py`

Atualizar para `1.2.6` para rastrear o deploy da reversao.

## Acao pos-deploy

1. Atualizar o agente no NEXTA-AAX (copiar o arquivo ou usar auto-update)
2. Limpar `__pycache__`: `rm -rf /opt/iscope-agent/agent/executors/__pycache__`
3. Reiniciar: `systemctl restart iscope-agent`
4. Disparar nova analise M365
5. O comportamento deve ser identico ao TASCHIBRA-IDA (sucesso)

