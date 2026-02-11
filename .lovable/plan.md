

# Filtrar CVEs por Workspace Efetivo

## Problema

O hook `useFirewallCVEs` busca versoes de firmware de **todos** os firewalls que o usuario real tem acesso (via RLS), sem considerar o modo preview. Quando um super_admin visualiza como um usuario de workspace especifico, os CVEs de todos os workspaces sao exibidos.

## Solucao

Aplicar o mesmo padrao de filtragem por workspace usado em `useDashboardStats` e `useTenantConnection`: buscar primeiro os firewalls do workspace efetivo e usar seus IDs para filtrar o `analysis_history`.

## Alteracoes

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useFirewallCVEs.ts` | Adicionar filtragem por workspace usando `usePreview` context |

## Detalhes tecnicos

### Fluxo atual

```text
1. SELECT * FROM analysis_history (sem filtro de workspace)
2. Extrair versoes de firmware
3. Buscar CVEs para cada versao
```

### Fluxo corrigido

```text
1. Buscar firewalls filtrando por client_id do workspace efetivo (quando em preview mode)
   - SELECT id FROM firewalls WHERE client_id IN (workspace_ids)
2. SELECT * FROM analysis_history WHERE firewall_id IN (firewall_ids_filtrados)
3. Extrair versoes de firmware (agora apenas do workspace)
4. Buscar CVEs para cada versao
```

### Mudancas no hook

- Converter `useFirewallCVEs` para receber os workspace IDs como parametro (ou usar internamente o `usePreview`)
- Na funcao `fetchFirmwareVersions`, adicionar filtro `.in('firewall_id', firewallIds)` quando houver restricao de workspace
- Primeiro buscar os IDs dos firewalls do workspace: `supabase.from('firewalls').select('id').in('client_id', workspaceIds)`
- Incluir `workspaceIds` na `queryKey` para invalidar cache ao trocar de workspace
- O componente `FirewallCVEsPage` passara a usar `usePreview` e repassar os workspace IDs ao hook

