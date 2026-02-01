

## Correção do Header do PDF

### Problemas Identificados
1. O logo e o texto "iScope 360" não estão alinhados horizontalmente (logo aparece deslocado)
2. Espaçamento vertical entre as linhas do header está muito pequeno

### Layout Desejado (conforme print 3)
```
Linha 1: [           iScope 360           ] [Logo à direita]
                     ↕ (espaçamento maior)
Linha 2: [Análise de Domínio Externo]       [Data executada]
         [agudos.sp.gov.br]                 [Workspace]
```

### Alterações Técnicas

**Arquivo:** `src/components/pdf/sections/PDFHeader.tsx`

1. **Alinhar logo com texto "iScope 360":**
   - Ajustar o posicionamento absoluto do logo para usar `top: '50%'` com offset negativo para centralizar verticalmente
   - Ou melhor: calcular a posição baseada na altura da linha

2. **Aumentar espaçamento vertical:**
   - Aumentar `marginBottom` na `topRow` de 12 para 20-24px
   - Remover ou reduzir o `marginTop: 4` na `infoRow`

### Código Resultante

```typescript
const styles = StyleSheet.create({
  // ... container sem alterações
  topRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24, // Aumentado de 12 para 24
    position: 'relative',
    minHeight: 60, // Garantir altura mínima para o logo
  },
  logoContainer: {
    position: 'absolute',
    right: 0,
    top: '50%', // Centralizar verticalmente
    transform: 'translateY(-50%)', // Ajuste para centralização
    // Nota: react-pdf não suporta transform, usar cálculo manual
  },
  // ...
});
```

**Nota técnica:** Como `@react-pdf/renderer` não suporta `transform`, usaremos uma abordagem alternativa - definir `minHeight` na topRow e usar `alignItems: 'center'` junto com ajuste manual do `top` do logoContainer.

### Ajustes Finais

1. **topRow:**
   - `marginBottom`: 12 → 24 (dobrar espaçamento)
   - `minHeight`: adicionar 60 (altura do logo)

2. **logoContainer:**
   - Remover `top: 0`
   - O posicionamento absoluto com `alignItems: 'center'` no pai deve centralizar

3. **infoRow:**
   - `marginTop`: 4 → 0 (remover, já tem espaço suficiente do marginBottom acima)

