

## Correção do `spo_tenant_quota` — URL admin incorreta

### Diagnóstico

O campo `tenant_domain` em `m365_tenants` armazena o domínio de e-mail (ex: `deployitgroup.mail.onmicrosoft.com`, `TASCHIBRA.mail.onmicrosoft.com`), mas o domínio do SharePoint Admin é derivado do domínio **principal** do tenant, que frequentemente difere.

O código atual:
```python
spo_admin_domain = (organization or '').replace('.onmicrosoft.com', '').split('.')[0]
```

Para `deployitgroup.mail.onmicrosoft.com` gera `deployitgroup`, mas o SPO admin pode estar em outro subdomínio. Além disso, tenants com domínios customizados (ex: `precisioglobal.com.br`) não seguem esse padrão.

### Solução proposta

**1. Adicionar campo `spo_domain` à tabela `m365_tenants`**

Um novo campo opcional que armazena explicitamente o subdomínio SPO (ex: `precisioglobal`), permitindo que cada tenant tenha a URL admin correta independente do `tenant_domain`.

**2. Popular `spo_domain` automaticamente no onboarding**

Na Edge Function `connect-m365-tenant` (e `m365-oauth-callback`), ao conectar um tenant, consultar a Graph API para obter o domínio inicial verificado do tenant:
```
GET /organization?$select=verifiedDomains
```
Filtrar pelo domínio `.onmicrosoft.com` (sem `.mail`) e extrair o prefixo. Salvar em `spo_domain`.

**3. Atualizar o agente para usar `spo_domain`**

No `tasks.py`, incluir `spo_domain` no contexto M365. No `powershell.py`, usar `spo_domain` quando disponível, com fallback para a lógica atual.

**4. Adicionar campo no `rpc_get_agent_tasks`**

Incluir `spo_domain` no payload de target para que o agente receba o valor correto.

### Alternativa mais simples (recomendada)

Em vez de criar um novo campo, **ajustar a lógica de derivação** no `powershell.py` para tratar corretamente domínios `.mail.onmicrosoft.com`:

```python
# Antes (incorreto para .mail.onmicrosoft.com):
spo_admin_domain = (organization or '').replace('.onmicrosoft.com', '').split('.')[0]

# Depois (remove .mail antes):
raw = (organization or '').replace('.mail.onmicrosoft.com', '').replace('.onmicrosoft.com', '').split('.')[0]
```

Isso resolve `TASCHIBRA.mail.onmicrosoft.com` → `TASCHIBRA` e `precisioglobal.onmicrosoft.com` → `precisioglobal`.

**Porém**, se o domínio SPO admin de um tenant não corresponder ao prefixo do `tenant_domain` (ex: tenant_domain é `deployitgroup.mail.onmicrosoft.com` mas o SPO admin é `precisioglobal-admin.sharepoint.com`), a solução com campo explícito `spo_domain` é necessária.

### Arquivos alterados

| Arquivo | Ação |
|---|---|
| `python-agent/agent/executors/powershell.py` | Ajustar derivação do `spo_admin_domain` para remover `.mail` |

Caso opte pela solução completa com campo dedicado:

| Arquivo | Ação |
|---|---|
| `python-agent/agent/executors/powershell.py` | Usar `spo_domain` do contexto quando disponível |
| `python-agent/agent/tasks.py` | Incluir `spo_domain` no contexto M365 |
| `supabase/functions/connect-m365-tenant/index.ts` | Popular `spo_domain` via Graph API `verifiedDomains` |
| `supabase/functions/m365-oauth-callback/index.ts` | Popular `spo_domain` via Graph API `verifiedDomains` |
| Edge Function `rpc_get_agent_tasks` ou SQL correspondente | Incluir `spo_domain` no target |

