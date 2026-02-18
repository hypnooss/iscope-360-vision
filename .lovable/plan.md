
# Refatorar Firewall > Compliance espelhando Domínio Externo > Compliance

## Diagnóstico: diferenças atuais

| Aspecto | Firewall > Compliance (atual) | Externo > Compliance (referência) |
|---|---|---|
| Seletor de Workspace | Ausente | No cabeçalho, topo direito, apenas Super roles |
| Cards de estatísticas | Ausente | 5 cards: Total, Pendentes, Executando, Concluídas, Falhas |
| Campo de busca | Ausente | Input de busca por nome/cliente |
| Filtros antigos | 2 Select (cliente + firewall) | Substituídos por busca + workspace selector |
| Lógica de dados | Busca apenas histórico | Busca todos os firewalls + histórico (inclui sem análise) |
| Estado de execução | Não existe | Badge de status + coluna "Status Execução" |
| Botão Play (analisar) | Ausente | Presente na coluna Ações |
| Botão Download PDF | Presente | Ausente (mantemos no firewall) |
| Card da tabela | Com CardHeader/CardTitle | Sem cabeçalho, `p-0` direto no CardContent |
| `useEffectiveAuth` | Não importado | Importado para checar `effectiveRole` |
| `useQuery` | Não usado | Usado para buscar workspaces |

## Estrutura da nova página

```text
FirewallReportsPage (refatorada)
├── PageBreadcrumb
├── Header + Workspace Selector (topo direito, super roles)
├── Stats Cards (5 cards: Total, Pendentes, Executando, Concluídas, Falhas)
├── Barra de busca (Input com ícone Search)
└── Card da tabela (p-0, sem CardHeader)
    └── Table
        ├── Firewall (nome + badge nº análises)
        ├── Workspace
        ├── Último Score (badge colorido)
        ├── Status Execução (badge de status ou "Sem análise")
        ├── Data (Select com datas ou "—")
        └── Ações (Play | Visualizar | Download PDF)
```

## Mudanças técnicas em `src/pages/firewall/FirewallReportsPage.tsx`

### 1. Imports adicionados
- `useEffectiveAuth` de `@/hooks/useEffectiveAuth`
- `useQuery` de `@tanstack/react-query`
- `Input` de `@/components/ui/input`
- Ícones: `Search`, `Building2`, `Activity`, `Clock`, `CheckCircle2`, `XCircle`, `Play` do `lucide-react`
- Remover: `Filter`, `CardHeader`, `CardTitle`, `CardDescription` (não mais usados)

### 2. Novos estados
```ts
const { effectiveRole } = useEffectiveAuth();
const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';
const [search, setSearch] = useState('');
const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
const [firewallsMeta, setFirewallsMeta] = useState<{id, name, client_id, agent_id, client_name}[]>([]);
```
- Remover: `selectedClient`, `selectedFirewall`, `clients`, `firewalls` (filtros antigos)

### 3. `useQuery` para workspaces
```ts
const { data: workspaces = [] } = useQuery({
  queryKey: ['firewall-compliance-workspaces'],
  queryFn: async () => { /* busca clients */ },
  enabled: isSuperRole
});
```

### 4. Refatorar `fetchReports`
- Buscar **todos os firewalls** do workspace (não apenas os que têm histórico)
- Salvar metadata em `firewallsMeta` (análogo ao `domainsMeta`)
- Buscar histórico filtrado por `firewall_id` IN (ids dos firewalls)
- Adicionar campo `status` e `completed_at` na interface `AnalysisReport`
- Remover `setClients` e `setFirewalls` (filtros antigos)

### 5. Refatorar `groupedFirewalls` (useMemo)
- Semear todos os firewalls (mesmo sem análise) via `firewallsMeta`
- Filtrar por `selectedWorkspaceId` (workspace selector)
- Filtrar por `search` (busca por nome ou workspace)

### 6. Auto-select primeiro workspace (super roles)
```ts
useEffect(() => {
  if (isSuperRole && workspaces.length > 0 && !selectedWorkspaceId) {
    setSelectedWorkspaceId(workspaces[0].id);
  }
}, [workspaces, isSuperRole, selectedWorkspaceId]);
```

### 7. Calcular `stats`
```ts
const stats = useMemo(() => {
  // Total, Pendentes, Executando, Concluídas, Falhas
  // baseado em analyses[0]?.status de cada grupo
}, [groupedFirewalls]);
```

### 8. Adicionar `handleAnalyze`
Disparar análise via edge function `trigger-firewall-analysis` (ou equivalente):
```ts
const handleAnalyze = async (firewallId: string) => {
  setAnalyzingId(firewallId);
  // chama supabase.functions.invoke('trigger-firewall-analysis', { body: { firewall_id } })
  await fetchReports();
  setAnalyzingId(null);
};
```

### 9. Refatorar `renderStatusBadge`
Mesmo padrão do Externo: pending/running/failed/completed com cores e ícone Loader2 animado.

### 10. Refatorar JSX
- **Header**: `flex md:flex-row justify-between` com título + seletor workspace à direita
- **Stats cards**: grid 5 colunas idêntico ao Externo
- **Barra de busca**: `Input` com `Search` icon, max-w-sm
- **Card tabela**: sem `CardHeader`, `CardContent p-0`
- **Colunas**: Firewall | Workspace | Último Score | Status Execução | Data | Ações
- **Ações**: botão Play (sempre visível) + Eye (só se `status === 'completed'`) + Download PDF

### 11. Verificar edge function para análise
Usar `trigger-firewall-analysis` (existente no projeto) passando `firewall_id`.

## Arquivo alterado

- `src/pages/firewall/FirewallReportsPage.tsx` — refatoração completa espelhando o padrão do Externo
