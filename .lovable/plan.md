

## Alinhar FirewallPDF ao padrão do ExternalDomainPDF

### Resumo das diferenças atuais

| Aspecto | Domain PDF (padrão) | Firewall PDF (atual) |
|---------|---------------------|----------------------|
| Pág 1 | Header + HowToRead + PostureOverview | Header + ScoreGauge + Stats + DeviceInfo + StatusCards + CategoryTable + Issues |
| Pág 2 | DomainInfo + CategorySummaryTable | — |
| Detalhes | "Guia de Correções" com ExplanatoryCards agrupados por categoria | "Detalhamento por Categoria" com PDFCategorySection (headers coloridos) |
| Aprovadas | Página dedicada com lista verde | Misturadas dentro das categorias |
| Plano de Ação | Página final com PDFActionPlan | Inexistente |
| Correction Guides | Usa `correctionGuides` do banco | Não suportado |

### Alterações planejadas

**1. `src/components/pdf/FirewallPDF.tsx` — Reescrever estrutura de páginas**

- **Página 1**: Header + PDFHowToRead + PDFPostureOverview (substituir ScoreGauge e stats por classificação por prioridade: critical/recommended/ok)
- **Página 2**: DeviceInfo + StatusCards (firmware/licensing/MFA) + PDFCategorySummaryTable (conteúdo firewall-específico mantido)
- **Página 3+ (wrap)**: "Guia de Correções" — substituir PDFCategorySection por PDFExplanatoryCard agrupados por categoria (mesmo layout do Domain), com `wrap={false}` no par título+primeiro card
- **Página dedicada**: "Verificações Aprovadas" — lista verde com página própria
- **Página final**: PDFActionPlan com ações imediatas (critical) e de curto prazo (recommended), ações contínuas genéricas de firewall

- Adicionar prop `correctionGuides?: CorrectionGuideData[]` ao componente
- Importar e usar `severityToPriority`, `getExplanatoryContent`, `PDFHowToRead`, `PDFPostureOverview`, `PDFExplanatoryCard`, `PDFActionPlan`
- Remover imports de `PDFScoreGauge`, `PDFIssuesSummary`, `PDFCategorySection`
- Reutilizar a mesma lógica de `categorizedChecks` (critical/recommended/passed) e `failedByCategory` do Domain PDF
- Adicionar helper `getGuideContent` (mesmo do Domain PDF)
- Adicionar styles para `passedTitle`, `passedList`, `passedItem`, `passedDot`, `passedText`, `categoryHeader`

**2. Callers do FirewallPDF — Adicionar `correctionGuides`**

Os arquivos que instanciam `<FirewallPDF>` precisam buscar e passar `correctionGuides`:
- `src/pages/firewall/FirewallCompliancePage.tsx`
- `src/pages/firewall/FirewallReportsPage.tsx`
- `src/pages/ReportsPage.tsx`
- `src/components/Dashboard.tsx`

Cada um precisa de uma query ao `rule_correction_guides` filtrando pelo `device_type_id` do firewall (mesmo padrão usado no ExternalDomainCompliancePage).

### Resultado final

O PDF de Firewall terá exatamente o mesmo fluxo visual do Domain PDF:
1. Capa com postura geral
2. Informações do dispositivo + tabela de categorias
3. Guia de correções com cards explicativos
4. Verificações aprovadas (página dedicada)
5. Plano de ação

