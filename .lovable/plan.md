

## Correção: Mapa de Infraestrutura DNS não aparece no PDF

### Diagnóstico

O componente `PDFDNSMap` não está sendo renderizado no PDF devido a **incompatibilidades com o `@react-pdf/renderer`**:

1. **Propriedade `gap` não suportada**: O react-pdf não suporta a propriedade CSS `gap`. Quando encontra essa propriedade, pode falhar silenciosamente.

2. **Caractere especial `◉`**: Pode causar problemas de codificação em algumas fontes.

3. **React Fragments (`<>...</>`)**: Podem causar problemas em contextos específicos do react-pdf.

### Solução

Substituir `gap` por `marginBottom`/`marginRight` e corrigir outros problemas de compatibilidade.

---

### Alterações Técnicas

**Arquivo:** `src/components/pdf/sections/PDFDNSMap.tsx`

#### 1. Corrigir estilos com `gap` (linhas 130-150)

**Antes:**
```typescript
grid: {
  flexDirection: 'row',
  padding: spacing.cardPadding,
  gap: 12,  // ❌ Não suportado
},
column: {
  flex: 1,
  gap: 10,  // ❌ Não suportado
},
groupHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 8,
  paddingVertical: 6,
  gap: 6,  // ❌ Não suportado
},
```

**Depois:**
```typescript
grid: {
  flexDirection: 'row',
  padding: spacing.cardPadding,
},
column: {
  flex: 1,
  marginRight: 12,  // ✓ Substitui gap
},
columnLast: {
  flex: 1,
  marginRight: 0,
},
groupCard: {
  borderWidth: 1,
  borderRadius: radius.md,
  overflow: 'hidden',
  marginBottom: 10,  // ✓ Substitui gap da column
},
groupHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 8,
  paddingVertical: 6,
},
headerIcon: {
  ...
  marginRight: 8,  // ✓ Substitui gap
},
```

#### 2. Corrigir caractere especial no header (linha 389)

**Antes:**
```tsx
<Text style={styles.headerIconText}>◉</Text>
```

**Depois:**
```tsx
<Text style={styles.headerIconText}>●</Text>
```

#### 3. Substituir Fragments por Views (linhas 400-410, etc.)

**Antes:**
```tsx
{visibleNs.length > 0 ? (
  <>
    {visibleNs.map(...)}
    {moreNs > 0 && (...)}
  </>
) : (...)}
```

**Depois:**
```tsx
{visibleNs.length > 0 ? (
  <View>
    {visibleNs.map(...)}
    {moreNs > 0 && (...)}
  </View>
) : (...)}
```

#### 4. Ajustar header gap (linha 109-111)

**Antes:**
```typescript
header: {
  ...
  gap: 8,
},
```

**Depois:**
```typescript
header: {
  ...
  // gap removido, usar marginRight no headerIcon
},
headerIcon: {
  ...
  marginRight: 8,
},
```

---

### Resumo das Correções

| Problema | Local | Correção |
|----------|-------|----------|
| `gap: 12` no grid | linha 133 | Usar `marginRight: 12` nas columns |
| `gap: 10` na column | linha 137 | Usar `marginBottom: 10` nos groupCards |
| `gap: 6` no groupHeader | linha 149 | Usar `marginRight: 6` no groupTitle |
| `gap: 8` no header | linha 111 | Usar `marginRight: 8` no headerIcon |
| Caractere `◉` | linha 389 | Trocar para `●` (mais compatível) |
| React Fragments | múltiplas | Substituir por `<View>` |

---

### Arquivos Modificados

- `src/components/pdf/sections/PDFDNSMap.tsx`

