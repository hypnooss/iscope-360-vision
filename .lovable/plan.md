
# Persistência do Workspace selecionado — todas as páginas

## Problema

Cada página mantém o `selectedWorkspaceId` em um `useState` local. Quando a página é recarregada (refresh, navegação, qualquer re-render forçado), o estado local é zerado e a auto-seleção cai sempre no primeiro da lista.

## Solução

Criar um hook reutilizável `useWorkspaceSelector` que persiste a seleção no `localStorage`. Assim, a escolha sobrevive a refreshes, navegações e até fechamento e reabertura da aba — e é compartilhada entre todas as páginas automaticamente.

O hook substituirá o padrão repetido `useState + useEffect` encontrado em 10 arquivos diferentes.

---

## Páginas afetadas (todas com `selectedWorkspaceId` local)

| Página | Arquivo |
|---|---|
| Ambiente | `src/pages/EnvironmentPage.tsx` |
| Agentes | `src/pages/AgentsPage.tsx` |
| Dashboard Geral | `src/pages/GeneralDashboardPage.tsx` |
| Lista de Firewalls | `src/pages/firewall/FirewallListPage.tsx` |
| Relatórios de Firewall | `src/pages/firewall/FirewallReportsPage.tsx` |
| Dashboard Analyzer | `src/pages/firewall/AnalyzerDashboardPage.tsx` |
| Lista de Domínios | `src/pages/external-domain/ExternalDomainListPage.tsx` |
| Relatórios de Domínios | `src/pages/external-domain/ExternalDomainReportsPage.tsx` |
| Analyzer de Superfície | `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` |

---

## Implementação técnica

### 1. Novo hook: `src/hooks/useWorkspaceSelector.ts`

```ts
const STORAGE_KEY = 'iscope_selected_workspace';

export function useWorkspaceSelector(
  workspaces: { id: string; name: string }[] | undefined,
  isSuperRole: boolean
) {
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState<string | null>(() => {
    // Inicializa a partir do localStorage na montagem
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || null;
    }
    return null;
  });

  // Quando workspaces carregam: validar se o salvo ainda existe,
  // caso contrário auto-selecionar o primeiro
  useEffect(() => {
    if (!isSuperRole || !workspaces?.length) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    const stillExists = saved && workspaces.some(w => w.id === saved);
    if (!stillExists) {
      // O workspace salvo foi removido ou é a primeira vez — auto-selecionar o primeiro
      const firstId = workspaces[0].id;
      setSelectedWorkspaceIdState(firstId);
      localStorage.setItem(STORAGE_KEY, firstId);
    }
    // Se o salvo ainda existe, o useState já o carregou — não fazer nada
  }, [workspaces, isSuperRole]);

  const setSelectedWorkspaceId = useCallback((id: string) => {
    setSelectedWorkspaceIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return { selectedWorkspaceId, setSelectedWorkspaceId };
}
```

**Comportamento:**
- Na primeira abertura: salva o primeiro workspace automaticamente
- Nas visitas seguintes: restaura o último selecionado
- Se o workspace salvo for excluído: fallback para o primeiro da lista
- Ao selecionar manualmente: persiste imediatamente no `localStorage`

### 2. Substituição em cada página

O padrão atual repetido em cada página:
```tsx
// ANTES (em cada página)
const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
useEffect(() => {
  if (isSuperRole && allWorkspaces?.length && !selectedWorkspaceId) {
    setSelectedWorkspaceId(allWorkspaces[0].id);
  }
}, [isSuperRole, allWorkspaces, selectedWorkspaceId]);
```

Será substituído por uma linha:
```tsx
// DEPOIS (em cada página)
const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceSelector(allWorkspaces, isSuperRole);
```

O `onValueChange` do `<Select>` continua chamando `setSelectedWorkspaceId` normalmente — o hook cuida da persistência internamente.

### 3. Caso especial: `AnalyzerDashboardPage`

Esta página também reseta o `selectedFirewall` ao trocar de workspace. O hook não interfere nisso — o `onValueChange` existente continua funcionando:
```tsx
onValueChange={(v) => { setSelectedWorkspaceId(v); setSelectedFirewall(''); }}
```

---

## Arquivos modificados

- **Novo:** `src/hooks/useWorkspaceSelector.ts`
- `src/pages/EnvironmentPage.tsx`
- `src/pages/AgentsPage.tsx`
- `src/pages/GeneralDashboardPage.tsx`
- `src/pages/firewall/FirewallListPage.tsx`
- `src/pages/firewall/FirewallReportsPage.tsx`
- `src/pages/firewall/AnalyzerDashboardPage.tsx`
- `src/pages/external-domain/ExternalDomainListPage.tsx`
- `src/pages/external-domain/ExternalDomainReportsPage.tsx`
- `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

---

## Observações

- O `localStorage` foi escolhido em vez de `sessionStorage` para que a seleção persista mesmo após fechar e reabrir o navegador.
- A chave `iscope_selected_workspace` é global — qualquer página que selecionar um workspace atualiza o valor para todas as outras, o que é o comportamento desejado.
- Preview Mode (`isPreviewMode`) não é afetado: as páginas já ignoram o `selectedWorkspaceId` quando estão em modo preview.
