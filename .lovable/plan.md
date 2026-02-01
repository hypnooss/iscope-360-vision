
## Plano: Integrar Configurações de Categorias nos Relatórios (Web + PDF)

### Contexto

Atualmente, as configurações definidas em **Administração > Templates > Visualização** (nome de exibição, ícone, cor e ordem) estão parcialmente integradas:

| Componente | Status Atual | Problema |
|------------|--------------|----------|
| `ExternalDomainCategorySection` (Web) | Parcial | Usa `getCategoryConfig`, mas ordenação não aplicada |
| `CategorySection` (Web - Firewall) | Parcial | Recebe `categoryConfigs` mas página não busca dados |
| `ExternalDomainPDF` | Hardcoded | Cores e nomes fixos no código |
| `FirewallPDF` | Hardcoded | Não usa configurações do banco |
| `PDFCategorySummaryTable` | Hardcoded | Exibe nome original, não `display_name` |

---

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/FirewallAnalysis.tsx` | Buscar `deviceTypeId` e `categoryConfigs` |
| `src/components/Dashboard.tsx` | Receber `categoryConfigs` e passar para componentes |
| `src/components/CategorySection.tsx` | Já recebe configs, sem alteração |
| `src/components/pdf/ExternalDomainPDF.tsx` | Receber configs e usar dinamicamente |
| `src/components/pdf/FirewallPDF.tsx` | Receber configs e usar dinamicamente |
| `src/components/pdf/sections/PDFCategorySummaryTable.tsx` | Receber configs para `displayName` |
| `src/components/pdf/sections/PDFCategorySection.tsx` | Receber configs para cores |
| `src/hooks/useCategoryConfig.ts` | Adicionar função `getColorHex` |
| `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx` | Ordenar categorias pelo `display_order` |

---

### Detalhes da Implementação

#### 1. Adicionar Helper para Obter Cor Hex

Adicionar função no `useCategoryConfig.ts` para converter nome da cor em hex:

```typescript
export function getColorHexByName(colorName: string): string {
  const colorOption = AVAILABLE_COLORS.find(c => c.name === colorName);
  return colorOption?.hex || '#64748b'; // slate-500 fallback
}
```

#### 2. Ordenar Categorias por `display_order`

Em `ExternalDomainAnalysisReportPage.tsx` e `Dashboard.tsx`, ordenar as categorias antes de renderizar:

```typescript
const sortedCategories = useMemo(() => {
  if (!report?.categories || !categoryConfigs) return report?.categories || [];
  
  return [...report.categories].sort((a, b) => {
    const configA = categoryConfigs.find(c => c.name === a.name);
    const configB = categoryConfigs.find(c => c.name === b.name);
    return (configA?.display_order ?? 999) - (configB?.display_order ?? 999);
  });
}, [report?.categories, categoryConfigs]);
```

#### 3. Integrar Configs no FirewallAnalysis

Buscar `device_type_id` do firewall e carregar configs:

```typescript
// FirewallAnalysis.tsx
const [deviceTypeId, setDeviceTypeId] = useState<string | null>(null);
const { data: categoryConfigs } = useCategoryConfigs(deviceTypeId || undefined);

// No fetchFirewall, armazenar device_type_id
if (data.device_type_id) {
  setDeviceTypeId(data.device_type_id);
}

// Passar para Dashboard
<Dashboard
  report={report}
  categoryConfigs={categoryConfigs}
  ...
/>
```

#### 4. Modificar Dashboard para Usar Configs

```typescript
// Dashboard.tsx
interface DashboardProps {
  // ... existente
  categoryConfigs?: CategoryConfig[];
}

// Ordenar categorias
const sortedCategories = useMemo(() => { ... }, [report.categories, categoryConfigs]);

// Passar para CategorySection
{sortedCategories.map((category, index) => (
  <CategorySection 
    key={category.name} 
    category={category} 
    index={index} 
    categoryConfigs={categoryConfigs}
  />
))}

// Passar para FirewallPDF
<FirewallPDF
  report={{ ...report, categories: sortedCategories }}
  categoryConfigs={categoryConfigs}
  ...
/>
```

#### 5. Modificar PDFs para Usar Configs Dinâmicos

**ExternalDomainPDF.tsx:**

```typescript
interface ExternalDomainPDFProps {
  // ... existente
  categoryConfigs?: CategoryConfig[];
}

// Substituir categoryColors hardcoded
const getColorForCategory = (categoryName: string): string => {
  const config = categoryConfigs?.find(c => c.name === categoryName);
  if (config) {
    return getColorHexByName(config.color);
  }
  // Fallback para cores padrão
  const defaultColors: Record<string, string> = {
    'Segurança DNS': colors.categoryDns,
    // ...
  };
  return defaultColors[categoryName] || colors.primary;
};

// Usar displayName na tabela de resumo
const categorySummaries: CategorySummary[] = sortedCategories.map((cat) => {
  const config = getCategoryConfig(categoryConfigs, cat.name);
  return {
    name: config.displayName, // Usar displayName
    ...
  };
});
```

**FirewallPDF.tsx:** Mesma lógica

#### 6. Passar Configs para PDFCategorySummaryTable

```typescript
interface PDFCategorySummaryTableProps {
  categories: CategorySummary[];
  categoryConfigs?: CategoryConfig[];
  title?: string;
}

// Já recebe nome traduzido via displayName no CategorySummary
```

---

### Fluxo de Dados Atualizado

```text
┌─────────────────────────────────────────────────────────────────┐
│                    rule_categories (DB)                          │
│   id | name | display_name | icon | color | display_order       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
             ┌─────────────────────────────────┐
             │     useCategoryConfigs(deviceTypeId)                │
             │     → CategoryConfig[]                              │
             └──────────────────────────────┬──────────────────────┘
                                            │
         ┌──────────────────────────────────┼─────────────────────┐
         │                                  │                     │
         ▼                                  ▼                     ▼
┌────────────────────┐     ┌────────────────────────┐   ┌────────────────────┐
│ ExternalDomain     │     │ Dashboard              │   │ FirewallPDF        │
│ AnalysisReportPage │     │ (Firewall Web)         │   │ ExternalDomainPDF  │
└─────────┬──────────┘     └───────────┬────────────┘   └─────────┬──────────┘
          │                            │                          │
          ▼                            ▼                          ▼
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐
│ ExternalDomainCategory │  │ CategorySection        │  │ PDFCategorySection │
│ Section (Web)          │  │ (Web)                  │  │ PDFSummaryTable    │
│ - displayName ✓        │  │ - displayName ✓        │  │ - displayName ✓    │
│ - icon ✓               │  │ - icon ✓               │  │ - color ✓          │
│ - color ✓              │  │ - color ✓              │  │ - order ✓          │
│ - order ✓              │  │ - order ✓              │  └────────────────────┘
└────────────────────────┘  └────────────────────────┘
```

---

### Resultado Esperado

Após a implementação, as configurações da aba **Visualização** serão aplicadas em:

| Elemento | Web | PDF |
|----------|-----|-----|
| Nome de exibição da categoria | Sim | Sim |
| Cor do cabeçalho da categoria | Sim | Sim |
| Ícone da categoria | Sim | N/A (PDF não suporta ícones Lucide) |
| Ordem de exibição | Sim | Sim |

---

### Arquivos Criados/Modificados

1. `src/hooks/useCategoryConfig.ts` - Adicionar `getColorHexByName`
2. `src/pages/FirewallAnalysis.tsx` - Buscar e passar configs
3. `src/components/Dashboard.tsx` - Usar configs, ordenar, passar para PDF
4. `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx` - Ordenar categorias, passar configs para PDF
5. `src/components/pdf/ExternalDomainPDF.tsx` - Usar configs dinâmicos
6. `src/components/pdf/FirewallPDF.tsx` - Usar configs dinâmicos
7. `src/components/pdf/sections/PDFCategorySummaryTable.tsx` - Receber displayName via CategorySummary
