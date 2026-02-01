

## Correção do Alinhamento Vertical da Recomendação

### Problema Atual
A linha cinza (`borderTopWidth: 1`) está aplicada diretamente no elemento `<Text>`, fazendo com que a borda e o texto fiquem "colados" verticalmente. O `marginTop` move o bloco inteiro (borda + texto), não criando espaço entre a borda e o texto.

### Estrutura Atual
```
<Text style={recommendation}>  ← borderTop aplicado aqui
  <Text>Recomendação:</Text>   ← texto colado na borda
  {check.recommendation}
</Text>
```

### Solução Proposta
Envolver a recomendação em uma `<View>` container, separando a borda do texto:

```
<View style={recommendationContainer}>  ← borderTop aplicado aqui
  <Text style={recommendationText}>     ← texto com paddingTop para espaçamento
    <Text>Recomendação:</Text>
    {check.recommendation}
  </Text>
</View>
```

### Alterações Técnicas

**Arquivo:** `src/components/pdf/sections/PDFCategorySection.tsx`

1. **Criar novo estilo `recommendationContainer`:**
```typescript
recommendationContainer: {
  marginLeft: 22,
  marginTop: 8,            // Espaço entre descrição e linha cinza
  paddingTop: 8,           // Espaço entre linha cinza e texto
  borderTopWidth: 1,
  borderTopColor: colors.border,
},
```

2. **Simplificar estilo `recommendation`:**
```typescript
recommendation: {
  fontSize: typography.bodySmall,
  color: colors.textSecondary,
  lineHeight: 1.4,
},
```

3. **Atualizar JSX:**
```tsx
{check.recommendation && (
  <View style={styles.recommendationContainer}>
    <Text style={styles.recommendation}>
      <Text style={styles.recommendationLabel}>Recomendação: </Text>
      {check.recommendation}
    </Text>
  </View>
)}
```

### Resultado Visual Esperado

```
Descrição do problema...
                              ← marginTop: 8px (espaço acima da linha)
────────────────────────────  ← borderTop (linha cinza)
                              ← paddingTop: 8px (espaço abaixo da linha)
Recomendação: texto...
```

