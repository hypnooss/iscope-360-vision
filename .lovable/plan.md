

## Análise — Erro "Current site is not a tenant administration site"

### Causa Raiz

O Agent PowerShell executa `Get-SPOTenant` (step `spo_tenant_quota`) para obter a quota de armazenamento do SharePoint. Para isso, precisa conectar na URL `https://<spo_domain>-admin.sharepoint.com`.

O problema está em `trigger-m365-analyzer/index.ts`:

1. **Select incompleto** (linha 39): busca `tenant_domain` mas **não busca `spo_domain`** da tabela `m365_tenants`
2. **Payload sem `spo_domain`** (linhas 209-229): envia apenas `tenant_domain` (ex: `deployitgroup.mail.onmicrosoft.com`) ao Agent
3. O Agent tenta usar `tenant_domain` para construir a URL admin do SPO, gerando algo como `https://deployitgroup.mail-admin.sharepoint.com` — que não é um site de administração válido

A tabela `m365_tenants` já possui o campo `spo_domain` correto (ex: `deployitgroup`), populado no onboarding via `verifiedDomains`.

### Correção

**Arquivo**: `supabase/functions/trigger-m365-analyzer/index.ts`

1. Adicionar `spo_domain` ao `select` do tenant (linha 39)
2. Incluir `spo_domain` no `payload` da task (após `tenant_id`, linha 212)

```
// Linha 39 — adicionar spo_domain
.select('id, display_name, tenant_domain, tenant_id, client_id, spo_domain')

// Payload — adicionar campo
payload: {
  ...
  tenant_id: tenant.tenant_id,
  spo_domain: tenant.spo_domain,   // ← NOVO
  snapshot_id: snapshot.id,
  ...
}
```

Após o deploy, o Agent receberá o `spo_domain` correto e construirá a URL `https://deployitgroup-admin.sharepoint.com` — resolvendo o erro.

### Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/trigger-m365-analyzer/index.ts` | Adicionar `spo_domain` ao select e payload |
| Deploy | `trigger-m365-analyzer` |

