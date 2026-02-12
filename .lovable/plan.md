
# Corrigir seletor de Workspace na pagina de Firewalls

## Problema

O seletor foi implementado no padrao do Dashboard (com "Todos os workspaces" e `useEffect` manual), quando deveria seguir o padrao do **Dominio Externo > Analyzer**.

## Diferencas entre os dois padroes

| Aspecto | Analyzer (correto) | Firewall (atual, errado) |
|---|---|---|
| Estado inicial | `null` | `'all'` |
| "Todos os workspaces" | Nao existe | Existe |
| Fetch de workspaces | `useQuery` com staleTime | `useEffect` manual |
| Auto-selecao | Primeiro workspace automaticamente | Nenhuma |

## Mudancas no arquivo `src/pages/firewall/FirewallListPage.tsx`

1. Trocar o estado `selectedWorkspaceId` de `string('all')` para `string | null (null)`
2. Remover o `useEffect` manual que busca workspaces e substituir por `useQuery` identico ao do Analyzer
3. Remover a opcao "Todos os workspaces" do `SelectContent`
4. Adicionar `useEffect` para auto-selecionar o primeiro workspace (mesmo padrao do Analyzer)
5. Ajustar a logica de filtro em `fetchData`: em vez de checar `!== 'all'`, checar se `selectedWorkspaceId` nao e null
6. Ajustar o `workspaceIds` passado ao `FirewallStatsCards` com a mesma logica
