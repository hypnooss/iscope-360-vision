# Plano de Migração: PDF Export para @react-pdf/renderer

## Objetivo
Migrar a exportação de relatórios PDF de `jsPDF` (imperativo, coordenadas X/Y) para `@react-pdf/renderer` (declarativo, React + Flexbox), resultando em PDFs visualmente profissionais que espelham a qualidade do dashboard web.

---

## Fase 1: Setup e Infraestrutura

### 1.1 Instalar Dependências
- [ ] `@react-pdf/renderer` - biblioteca principal

### 1.2 Criar Estrutura de Pastas
```
src/
├── components/
│   └── pdf/
│       ├── ExternalDomainPDF.tsx     # Documento PDF para domínios externos
│       ├── FirewallPDF.tsx           # Documento PDF para firewalls
│       ├── styles/
│       │   └── pdfStyles.ts          # Design system centralizado
│       ├── sections/
│       │   ├── PDFHeader.tsx         # Cabeçalho com título e data
│       │   ├── PDFScoreGauge.tsx     # Gauge de score circular SVG
│       │   ├── PDFStatsRow.tsx       # Cards de estatísticas
│       │   ├── PDFDomainInfo.tsx     # Painel info DNS (domínios)
│       │   ├── PDFFirewallInfo.tsx   # Painel info (firewalls)
│       │   ├── PDFIssuesSummary.tsx  # Box "Problemas Encontrados"
│       │   ├── PDFCategorySection.tsx # Seção por categoria
│       │   └── PDFFooter.tsx         # Rodapé com paginação
│       └── shared/
│           ├── PDFBadge.tsx          # Badge de severidade
│           ├── PDFStatusIcon.tsx     # Ícones de status (pass/fail)
│           └── PDFDivider.tsx        # Separadores estilizados
```

---

## Fase 2: Design System para PDF

### 2.1 Definir Paleta de Cores
```typescript
// pdfStyles.ts
export const colors = {
  // Backgrounds
  pageBg: '#0F172A',       // slate-900
  cardBg: '#1E293B',       // slate-800
  cardBgLight: '#334155',  // slate-700
  
  // Primary
  primary: '#14B8A6',      // teal-500
  primaryLight: '#5EEAD4', // teal-300
  
  // Text
  textPrimary: '#F8FAFC',  // slate-50
  textSecondary: '#CBD5E1', // slate-300
  textMuted: '#94A3B8',    // slate-400
  
  // Status
  success: '#22C55E',      // green-500
  warning: '#F59E0B',      // amber-500
  danger: '#EF4444',       // red-500
  info: '#3B82F6',         // blue-500
  
  // Severity
  critical: '#DC2626',     // red-600
  high: '#EA580C',         // orange-600
  medium: '#CA8A04',       // yellow-600
  low: '#0284C7',          // sky-600
};
```

### 2.2 Tipografia
- Fonte padrão: Helvetica (built-in, sem registro necessário)
- Hierarquia: title (24pt), heading (14pt), body (10pt), caption (8pt)

### 2.3 Espaçamentos
```typescript
export const spacing = {
  page: 30,      // margens da página
  section: 16,   // entre seções
  card: 12,      // padding interno de cards
  item: 8,       // entre itens de lista
};
```

---

## Fase 3: Componentes a Desenvolver

### 3.1 PDFHeader
- Título "iScope 360" em destaque
- Subtítulo com nome do alvo (domínio ou firewall)
- Data de geração formatada
- Linha decorativa gradiente

### 3.2 PDFScoreGauge
- Círculo SVG com arco colorido baseado no score
- Número do score centralizado (grande)
- Texto "Score" abaixo
- Cores: verde (>80), amarelo (60-80), vermelho (<60)

### 3.3 PDFStatsRow
- 4 mini-cards em linha (Flexbox row)
- Total, Aprovadas, Falhas, Alertas
- Cada um com ícone colorido e valor

### 3.4 PDFDomainInfo
- Grid 2 colunas
- Campos: SOA, Nameservers (lista), Contato, DNSSEC, SPF, DKIM, DMARC
- Ícones indicativos de status

### 3.5 PDFFirewallInfo
- Grid 2 colunas
- Campos: Fabricante, Modelo, Serial, Firmware, URL, Uptime

### 3.6 PDFIssuesSummary
- Box com borda vermelha
- Título "Problemas Encontrados (N)"
- Lista de todas as falhas com bullet colorido por severidade
- Truncamento se >15 itens

### 3.7 PDFCategorySection
- Header com nome da categoria e pass rate %
- Lista de checks:
  - Cada item com: status icon, nome, severidade badge
  - Descrição
  - Recomendação (se houver)
- Page break automático entre categorias longas

### 3.8 PDFFooter
- Número da página (render props do react-pdf)
- "Gerado por iScope 360"

---

## Fase 4: Ordem de Implementação

1. [ ] Instalar `@react-pdf/renderer`
2. [ ] Criar `src/components/pdf/styles/pdfStyles.ts`
3. [ ] Criar componentes shared (Badge, StatusIcon, Divider)
4. [ ] Criar `PDFHeader.tsx`
5. [ ] Criar `PDFScoreGauge.tsx` com SVG
6. [ ] Criar `PDFStatsRow.tsx`
7. [ ] Criar `PDFDomainInfo.tsx`
8. [ ] Criar `PDFFirewallInfo.tsx`
9. [ ] Criar `PDFIssuesSummary.tsx`
10. [ ] Criar `PDFCategorySection.tsx`
11. [ ] Criar `PDFFooter.tsx`
12. [ ] Criar `ExternalDomainPDF.tsx` (documento completo)
13. [ ] Criar `FirewallPDF.tsx` (documento completo)
14. [ ] Criar `src/hooks/usePDFDownload.ts` (pdf() + blob + download)
15. [ ] Integrar no botão "Exportar PDF" existente
16. [ ] Testar com dados reais
17. [ ] Remover jsPDF e código legado

---

## Fase 5: Integração

### Hook usePDFDownload
```tsx
import { pdf } from '@react-pdf/renderer';

export function usePDFDownload() {
  const downloadPDF = async (document: React.ReactElement, filename: string) => {
    const blob = await pdf(document).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  return { downloadPDF };
}
```

### Uso no Componente
```tsx
const { downloadPDF } = usePDFDownload();

const handleExport = () => {
  downloadPDF(
    <ExternalDomainPDF report={report} domain={domainName} />,
    `iscope360-${domainName}-${date}.pdf`
  );
};
```

---

## Fase 6: Cleanup

- [ ] Remover `jspdf` do package.json
- [ ] Remover `jspdf-autotable` do package.json
- [ ] Deletar funções antigas em `src/utils/pdfExport.ts`
- [ ] Atualizar imports nos componentes que usavam

---

## Comparativo Visual Esperado

| Elemento | jsPDF (Atual) | @react-pdf/renderer (Novo) |
|----------|---------------|----------------------------|
| Score | Retângulos empilhados | Círculo SVG com gradiente |
| Stats | Texto simples | Cards com ícones e cores |
| Info Panel | Linhas de texto | Grid organizado |
| Categorias | Tabela básica | Cards estilizados |
| Badges | Texto colorido | Badges com background |
| Layout | Fixo, quebra manual | Flexbox, page break auto |

---

## Estimativa

| Fase | Prompts Estimados |
|------|-------------------|
| Setup + Styles | 1 |
| Shared Components | 1 |
| Header + Score + Stats | 2 |
| Info Panels | 1 |
| Issues + Categories | 2 |
| Footer + Documento | 1 |
| Integração + Teste | 2 |
| Cleanup | 1 |
| **Total** | **~11 prompts** |

---

## Próximo Passo

Responda com:
> "Inicie a Fase 1: instale @react-pdf/renderer e crie o design system"
