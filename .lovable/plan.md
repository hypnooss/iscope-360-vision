

## Plano: Filtros por produto na tela de Compliance + preparar Entra ID para conteúdo rico

### Resumo

Adicionar filtros por produto (Entra ID, Exchange Online, SharePoint, Defender, Intune, Todos) na página de Compliance M365, permitindo filtrar as verificações exibidas e exportar apenas a visualização filtrada no PDF.

### Alterações

#### 1. `src/pages/m365/M365PosturePage.tsx`

**Novo estado de filtro por produto:**
```ts
const [productFilter, setProductFilter] = useState<string | null>(null);
```

**Barra de filtros** — inserir abaixo do Command Central, acima de "Verificações por Categoria":
- Chips/botões toggle: `Todos`, `Entra ID`, `Exchange Online`, `SharePoint`, `Defender`, `Intune`
- Usar `PRODUCT_LABELS` do `m365Insights.ts`
- Visual: botão `variant="outline"` com `ring-2 ring-primary` quando ativo

**Lógica de filtragem:**
```ts
const filteredItems = useMemo(() => {
  if (!productFilter) return allUnifiedItems;
  return allUnifiedItems.filter(item => item.product === productFilter);
}, [allUnifiedItems, productFilter]);
```

Usar `filteredItems` em vez de `allUnifiedItems` para:
- `groupedItems` (seções de categoria)
- `passCount` / `failCount` (contadores do Command Central)
- Ref do PDF (`allUnifiedItemsRef.current`)

**Garantir product no AgentInsight:** No mapper `mapM365AgentInsight` em `complianceMappers.ts`, o campo `product` não é mapeado. Precisamos adicioná-lo baseado na categoria:

```ts
// Em complianceMappers.ts, dentro de mapM365AgentInsight:
product: (insight as any).product || inferProductFromCategory(insight.category),
```

Função helper `inferProductFromCategory`:
```ts
function inferProductFromCategory(category: string): string | undefined {
  const map: Record<string, string> = {
    identities: 'entra_id',
    auth_access: 'entra_id',
    admin_privileges: 'entra_id',
    apps_integrations: 'entra_id',
    email_exchange: 'exchange_online',
    threats_activity: 'entra_id',
    intune_devices: 'intune',
    pim_governance: 'entra_id',
    sharepoint_onedrive: 'sharepoint',
    teams_collaboration: 'exchange_online',
    defender_security: 'defender',
  };
  return map[category];
}
```

**PDF exporta visualização filtrada:** O `handleExportPDF` já usa `allUnifiedItemsRef.current`, que passará a apontar para `filteredItems`. Adicionar indicação no filename quando filtrado (ex: `iscope360-m365-entra-id-tenant-2026-03-07.pdf`).

#### 2. `src/lib/complianceMappers.ts`

- Adicionar função `inferProductFromCategory` 
- No `mapM365AgentInsight`, incluir `product: (insight as any).product || inferProductFromCategory(insight.category)`

#### 3. `src/pages/m365/EntraIdPage.tsx`

Manter a página existente por enquanto — a reestruturação com conteúdo rico será feita no próximo passo após o usuário fornecer os requisitos.

### Arquivos modificados

1. `src/pages/m365/M365PosturePage.tsx` — filtros de produto + filtragem de items + PDF filtrado
2. `src/lib/complianceMappers.ts` — mapear `product` no AgentInsight

