

## Correção do Layout da Página 1 do PDF

### Problema Identificado

A tabela "Resumo por Categoria" está sendo empurrada para a Página 2 quando o domínio possui 4 ou mais nameservers, pois:
1. O componente `PDFDomainInfo` lista **todos** os nameservers
2. O espaçamento entre seções (`sectionGap`) é 20px

---

### Solução em Duas Partes

#### Parte 1: Limitar Exibição de Nameservers

**Arquivo:** `src/components/pdf/sections/PDFDomainInfo.tsx`

Limitar a exibição a **3 nameservers** e adicionar indicador "+ X nameservers" quando houver mais:

```
┌─ ANTES ────────────────────────┐    ┌─ DEPOIS ───────────────────────┐
│ Nameservers                    │    │ Nameservers                    │
│   • ns1.example.com            │    │   • ns1.example.com            │
│   • ns2.example.com            │    │   • ns2.example.com            │
│   • ns3.example.com            │    │   • ns3.example.com            │
│   • ns4.example.com            │    │   + 1 nameserver               │
└────────────────────────────────┘    └────────────────────────────────┘
```

**Lógica:**
```typescript
const MAX_NAMESERVERS = 3;
const visibleNameservers = nameservers.slice(0, MAX_NAMESERVERS);
const remainingCount = nameservers.length - MAX_NAMESERVERS;

// Render visibleNameservers...
{remainingCount > 0 && (
  <Text style={styles.moreItems}>
    + {remainingCount} nameserver{remainingCount > 1 ? 's' : ''}
  </Text>
)}
```

---

#### Parte 2: Reduzir Espaçamentos

**Arquivo:** `src/components/pdf/sections/PDFDomainInfo.tsx`

Reduzir o espaçamento entre:
- Container (`marginTop`: 8 → 6)
- Seções internas (`marginBottom`: 8 → 6)

**Arquivo:** `src/components/pdf/sections/PDFCategorySummaryTable.tsx`

Reduzir o espaçamento superior da tabela:
- Container (`marginTop`: `sectionGap` 20 → 12)

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `PDFDomainInfo.tsx` | Limitar nameservers a 3 + indicador; reduzir margens internas |
| `PDFCategorySummaryTable.tsx` | Reduzir `marginTop` do container de 20 para 12 |

---

### Resultado Esperado

1. **Consistência de altura** - Seção de Domain Info sempre ocupa ~4 linhas de nameservers
2. **Tabela na Página 1** - "Resumo por Categoria" volta a caber na primeira página
3. **Informação preservada** - Usuário sabe que existem mais nameservers via "+ X"

