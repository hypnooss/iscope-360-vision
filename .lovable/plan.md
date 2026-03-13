

## Diagnóstico: PnP.PowerShell falha com "X509 certificate store does not exist"

O erro ocorre na linha 70 de `powershell.py`. O `Connect-PnPOnline` está usando `-Thumbprint` para autenticação CBA, que tenta buscar o certificado no **Windows Certificate Store** — inexistente no Linux.

Os outros módulos (ExchangeOnline e MicrosoftGraph) usam `-CertificateFilePath "{cert_path}"` que aponta para o arquivo PFX diretamente, e por isso funcionam no Linux.

### Correção

**Arquivo:** `python-agent/agent/executors/powershell.py` (linha 70)

Trocar o parâmetro `-Thumbprint` por `-CertificatePath` apontando para o PFX:

```python
# DE:
"connect_cba": 'Connect-PnPOnline -Url "https://{spo_admin_domain}-admin.sharepoint.com" -ClientId "{app_id}" -Thumbprint "{thumbprint}" -Tenant "{tenant_id}"',

# PARA:
"connect_cba": 'Connect-PnPOnline -Url "https://{spo_admin_domain}-admin.sharepoint.com" -ClientId "{app_id}" -CertificatePath "{cert_path}" -Tenant "{tenant_id}"',
```

Isso alinha o PnP.PowerShell com o mesmo padrão dos outros módulos, usando o arquivo PFX no disco em vez do certificate store do Windows. Nenhum outro arquivo precisa ser alterado — o `{cert_path}` já é substituído por `str(self.PFX_FILE)` em todas as chamadas `.format()`.

Será necessário bumpar a versão para 1.3.11 e republicar o pacote.

