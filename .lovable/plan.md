
# Persistir Seletor de Firewall no Analyzer

## Objetivo

Aplicar o mesmo padrao de persistencia do seletor de Workspace (`useWorkspaceSelector`) ao seletor de Firewall nas paginas do Firewall Analyzer, para que o firewall selecionado seja lembrado ao navegar entre sub-paginas.

## Mudancas

### 1. Criar hook `src/hooks/useFirewallSelector.ts`

Hook generico seguindo o mesmo padrao de `useWorkspaceSelector`:
- Armazena o ID do firewall selecionado no `localStorage` com chave `iscope_selected_firewall`
- Ao carregar, restaura o valor salvo
- Se o valor salvo nao existir mais na lista de firewalls, seleciona o primeiro automaticamente
- Exporta `selectedFirewallId` e `setSelectedFirewallId`

### 2. Atualizar 4 paginas do Firewall Analyzer

Substituir o `useState('')` + `useEffect` de auto-selecao pelo novo `useFirewallSelector` nas seguintes paginas:

- `src/pages/firewall/AnalyzerDashboardPage.tsx`
- `src/pages/firewall/AnalyzerInsightsPage.tsx`
- `src/pages/firewall/AnalyzerCriticalPage.tsx`
- `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

Em cada pagina:
- Remover `const [selectedFirewall, setSelectedFirewall] = useState('')`
- Remover o `useEffect` que faz auto-selecao do primeiro firewall
- Adicionar `const { selectedFirewallId, setSelectedFirewallId } = useFirewallSelector(firewalls)`
- Renomear as referencias de `selectedFirewall` para `selectedFirewallId` (ou alias)

### Secao Tecnica

O hook recebe o array de firewalls carregado via react-query e valida se o ID salvo no localStorage ainda existe na lista. Quando o workspace muda e a lista de firewalls atualiza, o hook detecta que o ID salvo nao pertence mais a lista e auto-seleciona o primeiro disponivel, mantendo o comportamento atual mas com persistencia entre navegacoes.
