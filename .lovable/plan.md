

## Correção: Evitar Quebra de Layout no PDF

### Problema Identificado

O cabeçalho de seção "Subdomínios" está sendo renderizado no final de uma página enquanto o conteúdo vai para a próxima página. Isso acontece porque o `@react-pdf/renderer` não sabe que o cabeçalho e o conteúdo devem ficar juntos.

---

### Solução

Usar a propriedade `wrap={false}` estrategicamente para manter grupos de elementos juntos, e criar wrappers "quebráveis" para seções longas que garantam que o cabeçalho nunca fique sozinho.

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/pdf/sections/PDFDNSMap.tsx` | Adicionar `wrap={false}` em seções pequenas e `minPresenceAhead` no cabeçalho de subdomínios |

---

### Estratégias de Quebra de Página do react-pdf

1. **`wrap={false}`** - Impede que o elemento seja dividido entre páginas (move inteiro para próxima página se não couber)
2. **`minPresenceAhead`** - Garante que exista espaço mínimo após o elemento (útil para cabeçalhos)
3. **`break`** - Força quebra de página antes do elemento

---

### Mudanças no Código

#### PDFDNSMap.tsx - Seções com wrap={false} e minPresenceAhead

**Adicionar aos styles:**
```typescript
// Category header with minimum content guarantee
categoryHeaderWithContent: {
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: radius.md,
  marginBottom: 8,
  // Ensures at least 80pt of content follows before page break
  minPresenceAhead: 80,
},
```

**Modificar CategoryHeader para receber minPresenceAhead:**
```typescript
function CategoryHeader({ title, color, minPresenceAhead }: CategoryHeaderProps) {
  const headerStyle = minPresenceAhead 
    ? [styles.categoryHeader, { backgroundColor: color, minPresenceAhead }]
    : [styles.categoryHeader, { backgroundColor: color }];
    
  return (
    <View style={headerStyle}>
      <Text style={styles.categoryHeaderText}>{title}</Text>
    </View>
  );
}
```

**Aplicar wrap={false} em seções compactas (NS/SOA, MX):**
```typescript
{/* NS and SOA Side by Side - Keep together */}
<View style={styles.rowContainer} wrap={false}>
  ...
</View>

{/* MX Section - Keep together */}
<View style={styles.section} wrap={false}>
  ...
</View>

{/* TXT Section - Keep together */}
<View style={styles.section} wrap={false}>
  ...
</View>

{/* Subdomínios - Header must have content below */}
<View style={styles.section}>
  <CategoryHeader 
    title="Subdomínios" 
    color={headerColors.subdomain} 
    minPresenceAhead={100}  // Garante 100pt de conteúdo abaixo
  />
  ...
</View>
```

---

### Outras Melhorias de Quebra

**ExternalDomainPDF.tsx - Cabeçalhos de categoria:**
```typescript
// Category headers in Guia de Correções
<View key={categoryName}>
  <Text 
    style={pageStyles.categoryHeader} 
    minPresenceAhead={120}  // Garante pelo menos um card após o cabeçalho
  >
    {categoryName}
  </Text>
  ...
</View>
```

---

### Seção Técnica

**Como `minPresenceAhead` funciona:**

```text
┌────────────────────────────────────────┐
│ ... conteúdo anterior ...              │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │  HEADER (minPresenceAhead: 100)  │   │ ← Se não houver 100pt
│ └──────────────────────────────────┘   │   de espaço abaixo,
│                                        │   todo o grupo vai
│ Apenas 50pt restantes na página...     │   para próxima página
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ ┌──────────────────────────────────┐   │
│ │  HEADER (movido para cá)         │   │
│ └──────────────────────────────────┘   │
│                                        │
│ Conteúdo do subdomínio...              │
│ Conteúdo do subdomínio...              │
└────────────────────────────────────────┘
```

---

### Estimativa

| Tarefa | Tempo |
|--------|-------|
| Atualizar PDFDNSMap com wrap e minPresenceAhead | 20min |
| Atualizar ExternalDomainPDF (category headers) | 15min |
| Testes visuais | 15min |
| **Total** | **~50min** |

