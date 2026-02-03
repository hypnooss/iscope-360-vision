

## Adicionar Mapa de Infraestrutura DNS ao Relatório PDF

### Visão Geral

Criar uma nova página no PDF de Domínio Externo que exibe o Mapa de Infraestrutura DNS em formato estático, adaptado para impressão. O mapa será inserido entre a página de "Issues Summary" e a página de "Subdomínios Descobertos".

---

### Estrutura do Mapa no PDF

O layout será uma representação simplificada do mapa web, organizado em 3 colunas:

```text
┌─────────────────────────────────────────────────────────────┐
│           MAPA DE INFRAESTRUTURA DNS                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   NS Records    │   SOA / DNSSEC  │     Subdomínios         │
│   ───────────   │   ───────────── │     ───────────         │
│   ns1.host.com  │   Primary: ...  │     sub1.domain.com ●   │
│   ns2.host.com  │   Contact: ...  │     sub2.domain.com ●   │
│                 │   DNSSEC: Ativo │     sub3.domain.com ○   │
├─────────────────┼─────────────────┤     ...                 │
│   MX Records    │   TXT (Email)   │     (+X mais)           │
│   ───────────   │   ───────────── │                         │
│   mail.host.com │   SPF: ● ...    │                         │
│   priority: 10  │   DKIM: ● sel1  │                         │
│                 │   DMARC: ● p=.. │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

### Arquivos a Criar/Modificar

#### 1. Novo Componente: `src/components/pdf/sections/PDFDNSMap.tsx`

Componente dedicado para renderizar o mapa DNS no PDF:

```tsx
// Estrutura do componente
interface PDFDNSMapProps {
  dnsSummary?: DnsSummary;
  emailAuth?: { spf: boolean; dkim: boolean; dmarc: boolean };
  subdomainSummary?: SubdomainSummary;
  categories: ComplianceCategory[];
}

// Seções:
// - Título "Mapa de Infraestrutura DNS" 
// - Grid 3 colunas usando View + flexDirection: 'row'
// - Coluna 1: NS + MX (cards empilhados verticalmente)
// - Coluna 2: SOA/DNSSEC + TXT/Email Auth
// - Coluna 3: Subdomínios (lista com indicadores ●/○)
```

**Estilo Visual:**
- Usar cores da paleta existente em `pdfStyles.ts`
- Cards com bordas coloridas por tipo (sky para NS, violet para MX, etc.)
- Indicadores de status como círculos coloridos (●/○)
- Limite de 15 subdomínios na visualização com indicador "+X mais"

#### 2. Atualizar: `src/components/pdf/sections/index.ts`

Adicionar export do novo componente:

```typescript
export { PDFDNSMap } from './PDFDNSMap';
```

#### 3. Atualizar: `src/components/pdf/ExternalDomainPDF.tsx`

Inserir nova página com o mapa DNS após a página de Issues:

```tsx
{/* PAGE: DNS Infrastructure Map */}
<Page size="A4" style={pageStyles.page}>
  <View style={pageStyles.content}>
    <PDFDNSMap 
      dnsSummary={dnsSummary}
      emailAuth={emailAuth}
      subdomainSummary={subdomainSummary}
      categories={report.categories}
    />
  </View>
  <PDFFooter />
</Page>
```

---

### Detalhes Técnicos do PDFDNSMap

#### Extração de Dados

Reutilizar as mesmas funções helper do `DNSMapSection.tsx`:

```typescript
// Copiar e adaptar para o contexto PDF
const extractNsRecords = (categories) => { ... }
const extractMxRecords = (categories) => { ... }
const extractSpfRecord = (categories) => { ... }
const extractDkimKeys = (categories) => { ... }
const extractDmarcPolicy = (categories) => { ... }
```

#### Estilos Específicos

```typescript
const dnsMapStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: colors.cardBg,
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: colors.primary,
  },
  grid: {
    flexDirection: 'row',
    padding: spacing.cardPadding,
  },
  column: {
    flex: 1,
    paddingHorizontal: 6,
  },
  groupCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
  },
  groupTitle: {
    fontSize: typography.body,
    fontFamily: typography.bold,
    marginBottom: 6,
  },
  recordItem: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
});
```

#### Cores por Categoria

| Grupo | Cor da Borda | Background |
|-------|--------------|------------|
| NS | `#0EA5E9` (sky-500) | `#F0F9FF` (sky-50) |
| MX | `#A855F7` (purple-500) | `#FAF5FF` (purple-50) |
| SOA | `#F59E0B` (amber-500) | `#FFFBEB` (amber-50) |
| TXT | `#EC4899` (pink-500) | `#FDF2F8` (pink-50) |
| Subdomínios | `#6366F1` (indigo-500) | `#EEF2FF` (indigo-50) |

---

### Limites de Exibição

| Elemento | Limite | Indicador |
|----------|--------|-----------|
| NS Records | 6 | "+X nameservers" |
| MX Records | 4 | "+X mail servers" |
| DKIM Keys | 3 | "+X seletores" |
| Subdomínios | 15 | "+X subdomínios" |

---

### Ordem das Páginas (Atualizada)

1. **Página 1**: Resumo Executivo (Score, Stats, Info, Tabela de Categorias)
2. **Página 2**: Problemas Encontrados (se houver falhas)
3. **Página 3**: **Mapa de Infraestrutura DNS** ← NOVA
4. **Página 4**: Subdomínios Descobertos (tabela detalhada)
5. **Páginas 5+**: Detalhamento por Categoria

---

### Arquivos Modificados

- `src/components/pdf/sections/PDFDNSMap.tsx` (novo)
- `src/components/pdf/sections/index.ts` (atualizar exports)
- `src/components/pdf/ExternalDomainPDF.tsx` (adicionar página)

