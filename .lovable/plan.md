

## Atualizar spo_domain dos tenants existentes

Executar um UPDATE na tabela `m365_tenants` para popular o campo `spo_domain` dos 7 tenants existentes.

### SQL a executar (via insert tool)

```sql
UPDATE m365_tenants SET spo_domain = CASE
  WHEN tenant_domain = 'TASCHIBRA.mail.onmicrosoft.com' THEN 'TASCHIBRA'
  WHEN tenant_domain = 'aggroupbr.onmicrosoft.com' THEN 'aggroupbr'
  WHEN tenant_domain = 'iedomadeira.onmicrosoft.com' THEN 'iedomadeira'
  WHEN tenant_domain = 'deployitgroup.mail.onmicrosoft.com' THEN 'deployitgroup'
  WHEN tenant_domain = 'brinquedosestrela.onmicrosoft.com' THEN 'brinquedosestrela'
  WHEN tenant_domain = 'localfriologistica.onmicrosoft.com' THEN 'localfriologistica'
  WHEN tenant_domain = 'ourosafra.onmicrosoft.com' THEN 'ourosafra'
END
WHERE spo_domain IS NULL;
```

### Impacto

- Nenhuma alteração de schema, apenas dados
- O agente Python passará a usar esses valores para montar a URL correta do SharePoint Admin (`https://<spo_domain>-admin.sharepoint.com`)
- O step `spo_tenant_quota` deixará de falhar com "Current site is not a tenant administration site"

