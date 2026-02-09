

# Corrigir Split-Path: Usar -Certificate em vez de -CertificateFilePath

## Problema

O erro `Split-Path` nao ocorre no script do agente (que ja usa `-File` corretamente), mas **dentro** do modulo `ExchangeOnlineManagement 3.9+`. Internamente, o cmdlet `Connect-ExchangeOnline` faz `Split-Path` num caminho vazio quando usa o parametro `-CertificateFilePath` no Linux. Isso e um bug conhecido do modulo.

O `Import-Module` funciona perfeitamente -- o erro so aparece no `Connect-ExchangeOnline`.

## Solucao

Alterar os comandos de conexao para carregar o certificado como objeto `X509Certificate2` na memoria e passa-lo via parametro `-Certificate`, evitando completamente o codigo interno que causa o `Split-Path`.

## Mudanca Tecnica

### Arquivo: `python-agent/agent/executors/powershell.py`

Alterar as strings de conexao CBA nos dicionarios `MODULES`:

**ExchangeOnline - Antes:**
```
Connect-ExchangeOnline -AppId "{app_id}" -CertificateFilePath "{cert_path}" -CertificatePassword ([System.Security.SecureString]::new()) -Organization "{organization}" -ShowBanner:$false
```

**ExchangeOnline - Depois:**
```
$cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new("{cert_path}")
Connect-ExchangeOnline -AppId "{app_id}" -Certificate $cert -Organization "{organization}" -ShowBanner:$false
```

**MicrosoftGraph - Antes:**
```
Connect-MgGraph -ClientId "{app_id}" -CertificateFilePath "{cert_path}" -CertificatePassword ([System.Security.SecureString]::new()) -TenantId "{tenant_id}" -NoWelcome
```

**MicrosoftGraph - Depois:**
```
$cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new("{cert_path}")
Connect-MgGraph -ClientId "{app_id}" -Certificate $cert -TenantId "{tenant_id}" -NoWelcome
```

Como os comandos de conexao agora tem 2 linhas, eles precisam ser incluidos no script de forma diferente. A abordagem mais limpa e mover o carregamento do certificado para o inicio do script (apos o import) e referencia-lo na conexao.

Na funcao `_build_script`, apos o bloco de import do modulo, adicionar:

```python
# Load certificate into memory (avoids Split-Path bug in EXO 3.9+)
script_parts.extend([
    "# Load certificate",
    f'$cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new("{str(self.PFX_FILE)}")',
    "",
])
```

E alterar os comandos de conexao CBA para:

```python
"ExchangeOnline": {
    "connect_cba": 'Connect-ExchangeOnline -AppId "{app_id}" -Certificate $cert -Organization "{organization}" -ShowBanner:$false',
    ...
},
"MicrosoftGraph": {
    "connect_cba": 'Connect-MgGraph -ClientId "{app_id}" -Certificate $cert -TenantId "{tenant_id}" -NoWelcome',
    ...
},
```

### Arquivo: `python-agent/agent/version.py`

Incrementar versao para `1.2.5` para facilitar identificacao no servidor.

## Impacto

- Resolve o bug do `Split-Path` no EXO 3.9+ no Linux
- Compativel com todas as versoes do modulo EXO
- O parametro `-Certificate` aceita X509Certificate2 desde EXO v3
- Nao afeta o modo `credential` (que nao usa certificado)
- Nenhuma mudanca no MicrosoftGraph se `-Certificate` for suportado (e, desde Microsoft.Graph v2)

## Pos-Correcao

1. Atualizar o agente no servidor NEXTA
2. Disparar nova analise M365
3. Os comandos Exchange devem conectar sem erro

