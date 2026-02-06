

# Plano: Reorganizar Gestao de Tenants M365

## Resumo das Mudancas

O objetivo e centralizar a gestao de tenants em uma unica tela, permitindo ao cliente administrar seus tenants e iniciar analises diretamente do card, eliminando a tela de "Analise" separada.

## Mudancas no Menu de Navegacao

### Antes
```
Microsoft 365
├── Dashboard            <-- REMOVER
├── Análise              <-- REMOVER
├── Execuções
├── Relatórios
├── Entra ID
└── Conexão com Tenant   <-- RENOMEAR para "Tenants"
```

### Depois
```
Microsoft 365
├── Tenants        <-- NOVO NOME
├── Execuções
├── Relatórios
└── Entra ID              
```


## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/layout/AppLayout.tsx` | Remover item "Analise", renomear "Conexao com Tenant" para "Tenants" |
| `src/App.tsx` | Remover rota `/scope-m365/analysis` e import do `M365AnalysisPage` |
| `src/pages/m365/TenantConnectionPage.tsx` | Atualizar titulo/breadcrumb para "Tenants" |
| `src/components/m365/TenantStatusCard.tsx` | Redesenhar para layout full-width com novas infos |
| `src/pages/m365/M365AnalysisPage.tsx` | Pode ser removido (arquivo nao mais usado) |

## Novo Design do Card de Tenant

O card atual ocupa metade da tela (grid 2 colunas). O novo layout ocupara a largura total com as informacoes organizadas horizontalmente:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 🏢 Contoso Corp                                                    ● Conectado         │
│    contoso.onmicrosoft.com                                                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  Workspace          Última Análise              Score         Agendamento              │
│  ─────────────      ──────────────────          ─────         ────────────────────      │
│  ACME Corp          15/01/2026 14:30 (há 2h)    72%           Semanal (Dom 03:00)      │
│                                                                                         │
│  [Testar] [Editar] [Permissões] [Desconectar] [Excluir]                 [🔍 Analisar]  │
│                                                                                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**Elementos adicionados ao card:**
- **Workspace**: Nome do workspace vinculado ao tenant (ja existe no card, mas sera destacado)
- **Ultima Analise**: Data/hora da ultima analise de postura (buscar de `m365_posture_history`)
- **Score**: Score da ultima analise completada
- **Agendamento**: Futuro - mostrara "Nao configurado" por enquanto (placeholder para funcionalidade futura)
- **Botao Analisar**: Inicia analise de postura diretamente do card (mesma logica do `M365AnalysisPage`)

## Detalhes Tecnicos

### 1. Modificar TenantStatusCard.tsx

```typescript
// Adicionar props para analise
interface TenantStatusCardProps {
  tenant: TenantConnection;
  onTest: (tenantId: string) => Promise<...>;
  onDisconnect: (tenantId: string) => Promise<...>;
  onDelete: (tenantId: string) => Promise<...>;
  onUpdatePermissions?: (tenantId: string) => void;
  onEdit?: (tenantId: string) => void;
  onAnalyze?: (tenantId: string) => void;  // NOVA PROP
  lastAnalysis?: {                          // NOVA PROP
    score: number | null;
    status: string;
    created_at: string;
  } | null;
  isAnalyzing?: boolean;                    // NOVA PROP
}
```

### 2. Buscar Ultima Analise na TenantConnectionPage

A pagina `TenantConnectionPage.tsx` buscara a ultima analise de cada tenant:

```typescript
// Fetch last analysis for each tenant
const { data: analysisHistory } = useQuery({
  queryKey: ['m365-tenant-analyses'],
  queryFn: async () => {
    const tenantIds = tenants.map(t => t.id);
    const { data } = await supabase
      .from('m365_posture_history')
      .select('tenant_record_id, score, status, created_at')
      .in('tenant_record_id', tenantIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    return data;
  },
  enabled: tenants.length > 0,
});
```

### 3. Trigger de Analise no Card

O botao "Analisar" chamara a mesma Edge Function `trigger-m365-posture-analysis`:

```typescript
const handleAnalyze = async (tenantId: string) => {
  const { data, error } = await supabase.functions.invoke('trigger-m365-posture-analysis', {
    body: { tenant_record_id: tenantId },
  });
  // Mostrar toast e redirecionar para execucoes se sucesso
};
```

### 4. Layout do Grid na Pagina

Mudar de `grid-cols-2` para `grid-cols-1`:

```tsx
// Antes
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">

// Depois
<div className="grid grid-cols-1 gap-4">
```

## Modificacoes no AppLayout.tsx

Linha 123-134, atualizar `knownModuleNavConfigs['scope_m365']`:

```typescript
'scope_m365': {
  icon: Cloud,
  color: 'text-blue-500',
  items: [
    { label: 'Dashboard', href: '/scope-m365/dashboard', icon: LayoutDashboard },
    // REMOVER: { label: 'Análise', href: '/scope-m365/analysis', icon: Shield },
    { label: 'Execuções', href: '/scope-m365/executions', icon: Activity },
    { label: 'Relatórios', href: '/scope-m365/reports', icon: FileText },
    { label: 'Entra ID', href: '/scope-m365/entra-id', icon: Shield },
    { label: 'Tenants', href: '/scope-m365/tenant-connection', icon: Building }, // RENOMEADO
  ],
},
```

## Modificacoes no App.tsx

Remover:
- Linha 41: `const M365AnalysisPage = lazy(...)`
- Linha 103: `<Route path="/scope-m365/analysis" element={<M365AnalysisPage />} />`

## Preview Mode

O botao "Analisar" respeitara o `usePreviewGuard()` para bloquear acao em modo preview.

## Resultado Esperado

- Menu mais limpo sem item "Analise" separado
- Tela de Tenants como hub central de gestao
- Cards full-width com mais informacoes visiveis
- Acao de analisar acessivel diretamente do card
- Preparado para adicionar agendamento no futuro

