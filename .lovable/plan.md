

## Fix: PnP.PowerShell "Current site is not a tenant administration site"

### Diagnóstico

O `Connect-PnPOnline` com `-CertificatePath` no PnP.PowerShell v3.x requer o parâmetro `-CertificatePassword` (SecureString), mesmo que o PFX não tenha senha. Sem ele, a autenticação CBA pode falhar silenciosamente, e o `Get-PnPTenant` não reconhece o contexto como admin site.

Os outros módulos (ExchangeOnline e MicrosoftGraph) já passam `-CertificatePassword ([System.Security.SecureString]::new())`, mas o PnP não.

### Correção

**Arquivo:** `python-agent/agent/executors/powershell.py` (linha 70)

Adicionar `-CertificatePassword ([System.Security.SecureString]::new())` ao `connect_cba` do PnP.PowerShell:

```python
# DE:
"connect_cba": 'Connect-PnPOnline -Url "https://{spo_admin_domain}-admin.sharepoint.com" -ClientId "{app_id}" -CertificatePath "{cert_path}" -Tenant "{tenant_id}"',

# PARA:
"connect_cba": 'Connect-PnPOnline -Url "https://{spo_admin_domain}-admin.sharepoint.com" -ClientId "{app_id}" -CertificatePath "{cert_path}" -CertificatePassword ([System.Security.SecureString]::new()) -Tenant "{tenant_id}"',
```

Bumpar versão para **1.3.12** em `python-agent/agent/version.py`.

