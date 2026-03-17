

## Plano: Corrigir coleta de StorageQuota do SharePoint (erro "not a tenant administration site")

### Causa raiz

O step `spo_tenant_quota` usa o módulo `PnP.PowerShell` e é o **único** step PnP no blueprint. Como tem apenas 1 step, a execução cai no **modo legacy** (`_execute_powershell_batch_legacy` → `executor.run()` → `_build_script`).

O método `_build_script` (linha 133 de `powershell.py`) **não aceita o parâmetro `spo_domain`** e deriva o domínio SPO diretamente de `organization` (tenant_domain). Para tenants com domínio `.mail.onmicrosoft.com` (ex: `TASCHIBRA.mail.onmicrosoft.com`), a derivação pode falhar ou gerar uma URL incorreta, fazendo o `Connect-PnPOnline` conectar a um site que não é o admin.

O método mais novo `_build_script_file` (linha 386) já aceita e usa corretamente `spo_domain` via `_derive_spo_domain()`, mas o legacy não.

### Correções

**1. `python-agent/agent/executors/powershell.py`** — Adicionar `spo_domain` ao método `_build_script` (legacy):
- Adicionar parâmetro `spo_domain: Optional[str] = None` na assinatura (linha 133)
- Usar `self._derive_spo_domain(organization, spo_domain)` nas linhas 177 e 182 em vez da derivação inline
- No método `run()` (linha 793): extrair `spo_domain` do context e passá-lo para `_build_script`

**2. `python-agent/agent/executors/powershell.py`** — Mesma correção nos blocos de `_build_script` para `connect_credential` (linha 177) e `connect_cba` (linha 182):
```python
# Antes (linha 177):
module_config["connect_credential"].format(
    tenant_id=tenant_id, 
    spo_admin_domain=(organization or '').replace(...)
)

# Depois:
module_config["connect_credential"].format(
    tenant_id=tenant_id, 
    spo_admin_domain=self._derive_spo_domain(organization, spo_domain)
)
```

### Resumo
O campo `spo_domain` já existe na tabela `m365_tenants`, já é enviado no payload da tarefa e já é usado no modo interativo — mas o modo legacy (usado para steps PnP únicos) ignora esse campo. A correção é de 3 linhas para alinhar o legacy com o interativo.

