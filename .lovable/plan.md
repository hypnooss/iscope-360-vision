

## Diagnóstico: Por que "Revalidar Permissões" não resolve `Sites.Read.All`

O fluxo de "Revalidar Permissões" funciona em 3 passos:
1. **`ensure-exchange-permission`** — Atualiza o manifesto do App Registration no Azure, adicionando permissões faltantes
2. **Admin Consent popup** — O admin do tenant concede todas as permissões do manifesto
3. **Revalidação** — Testa cada permissão via API

O problema: **`Sites.Read.All` (Microsoft Graph) não está na lista `REQUIRED_PERMISSIONS`** do `ensure-exchange-permission/index.ts`. Portanto, nunca é adicionada ao manifesto, e o Admin Consent nunca a concede.

A lista atual tem `Sites.FullControl.All` (recurso SharePoint), mas falta `Sites.Read.All` (recurso Microsoft Graph — ID `332a536c-c7ef-4017-ab91-336970924f0d`).

### Correção

Adicionar `Sites.Read.All` à lista `REQUIRED_PERMISSIONS` em `ensure-exchange-permission/index.ts`:

```typescript
{ resourceAppId: GRAPH_RESOURCE_ID, permissionId: "332a536c-c7ef-4017-ab91-336970924f0d", name: "Sites.Read.All" },
```

### Arquivo a modificar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/ensure-exchange-permission/index.ts` | Adicionar `Sites.Read.All` (Graph) à lista REQUIRED_PERMISSIONS |

Após o deploy, basta clicar em **Revalidar Permissões** novamente — o manifesto será atualizado, o popup de Admin Consent concederá a permissão, e `Sites.Read.All` passará a funcionar.

