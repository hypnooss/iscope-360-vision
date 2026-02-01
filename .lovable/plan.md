

## Correção do PDF - Resumo por Categoria e Categorias

### Problemas Identificados

| Problema | Causa | Impacto |
|----------|-------|---------|
| **Tabela cortada** | `PDFCategorySummaryTable` não tem `wrap={false}` | Última linha da tabela fica sobreposta ao rodapé |
| **Categorias faltando** | Filtro exibe apenas categorias com falhas | Categorias 100% aprovadas não aparecem no detalhamento |

---

### Correção 1: Tabela "Resumo por Categoria"

O componente `PDFCategorySummaryTable` precisa impedir que a tabela seja quebrada entre páginas.

**Arquivo:** `src/components/pdf/sections/PDFCategorySummaryTable.tsx`

```typescript
// Adicionar wrap={false} no container da tabela
<View style={styles.table} wrap={false}>
```

Isso garante que a tabela inteira (com todas as 5 linhas) fique em uma única página, movendo para a próxima se não couber.

---

### Correção 2: Exibir Todas as Categorias

Atualmente o código filtra apenas categorias com falhas:
```typescript
const categoriesWithFailures = report.categories.filter(
  (cat) => cat.checks.some((c) => c.status === 'fail')
);
```

**Alterar para exibir todas as categorias:**

**Arquivo:** `src/components/pdf/ExternalDomainPDF.tsx`

```typescript
// ANTES: Apenas categorias com falhas
const categoriesWithFailures = report.categories.filter(
  (cat) => cat.checks.some((c) => c.status === 'fail')
);

// DEPOIS: Todas as categorias
// Remover o filtro e usar report.categories diretamente
```

E ajustar a condição de renderização:
```typescript
// ANTES
{categoriesWithFailures.length > 0 && (

// DEPOIS
{report.categories.length > 0 && (
```

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `PDFCategorySummaryTable.tsx` | Adicionar `wrap={false}` na tabela |
| `ExternalDomainPDF.tsx` | Remover filtro de `categoriesWithFailures`, usar todas as categorias |

---

### Resultado Esperado

1. **Tabela completa** - "Resumo por Categoria" exibe todas as 5 linhas sem corte
2. **Detalhamento completo** - Seção "Detalhamento por Categoria" exibe todas as 5 categorias (DNS, Email, SPF, DKIM, DMARC)
3. **Consistência** - Número de categorias no resumo = número de categorias no detalhamento

