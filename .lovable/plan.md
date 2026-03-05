

## Alinhar M365 Compliance ao padrão de Firewall/Domain Compliance

### 1. Botão "Executar Ações" com DropdownMenu

**Arquivo:** `src/pages/m365/M365PosturePage.tsx`

Substituir o botão "Executar Análise" atual (linha 282-287) e o botão de Settings (288-296) pelo mesmo padrão de dropdown usado em Firewall e Domain Compliance:

- Botão "Executar Ações" com `ChevronDown` e submenu com 4 opções:
  - **Gerar Análise** → chama `handleRefresh` existente
  - **Exportar PDF** → chama novo `handleExportPDF` (gera `M365PosturePDF`)
  - **Exportar CVE** → toast placeholder
  - **Gerar GMUD** → toast placeholder
- Botão Settings (ícone engrenagem) permanece ao lado

Imports a adicionar: `ChevronDown`, `FileDown`, `FileText`, `ClipboardList`, `DropdownMenu*`, `usePDFDownload`, `sanitizePDFFilename`, `getPDFDateString`.

### 2. Criar `M365PosturePDF` component

**Arquivo novo:** `src/components/pdf/M365PosturePDF.tsx`

Seguir exatamente o mesmo layout do `FirewallPDF.tsx` / `ExternalDomainPDF.tsx`:

- **Página 1**: `PDFHeader` + `PDFHowToRead` + `PDFPostureOverview`
- **Página 2**: Info do Tenant (nome, domínio, data, agent status) + `PDFCategorySummaryTable`
- **Página 3+ (wrap)**: "Guia de Correções" com `PDFExplanatoryCard` agrupados por categoria, com `wrap={false}` no par título+primeiro card
- **Página dedicada**: "Verificações Aprovadas" (lista verde)
- **Página final**: `PDFActionPlan`

Props:
```ts
interface M365PosturePDFProps {
  report: {
    overallScore: number;
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    categories: ComplianceCategory[];  // convertidas de UnifiedComplianceItem[]
    generatedAt: Date | string;
  };
  tenantInfo: {
    name: string;
    domain: string;
    clientName?: string;
  };
  logoBase64?: string;
  categoryConfigs?: CategoryConfig[];
  correctionGuides?: CorrectionGuideData[];
}
```

### 3. Converter dados M365 para formato de categorias

**No `M365PosturePage.tsx`**, adicionar lógica para converter `allUnifiedItems` (agrupados por categoria) para o formato `ComplianceCategory[]` que o PDF espera:

```ts
const pdfCategories = sortedCategories.map(cat => ({
  name: CATEGORY_LABELS[cat] || cat,
  passRate: calculatePassRate(groupedItems[cat]),
  checks: groupedItems[cat].map(item => ({
    id: item.code,
    name: item.name,
    status: item.status,
    severity: item.severity,
    description: item.description,
    recommendation: item.recommendation,
  })),
}));
```

### 4. Buscar correction guides para M365

**No `M365PosturePage.tsx`**, adicionar query para `rule_correction_guides` filtrando pelo `device_type_id` do M365 (código `m365` na tabela `device_types`):

```ts
const { data: correctionGuides } = useQuery({
  queryKey: ['m365-correction-guides'],
  queryFn: async () => {
    const { data } = await supabase
      .from('rule_correction_guides')
      .select('*, compliance_rules!inner(code, device_type_id, device_types!inner(code))')
      .eq('compliance_rules.device_types.code', 'm365');
    return data?.map(...) ?? [];
  },
});
```

### 5. Exportar no index

**Arquivo:** `src/components/pdf/index.ts` — adicionar export do `M365PosturePDF`.

### Resultado

O botão "Executar Análise" será substituído pelo dropdown "Executar Ações" com as 4 opções padrão. A opção "Exportar PDF" gerará um relatório no mesmo layout visual dos PDFs de Firewall e Domain Compliance.

