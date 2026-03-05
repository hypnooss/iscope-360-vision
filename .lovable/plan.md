

## Fix: Manter "Verificações Aprovadas" junto na mesma página do PDF

### Problema
No `ExternalDomainPDF.tsx`, o bloco de "Verificações Aprovadas" (título + lista verde) está dentro de uma `<Page wrap>` mas sem indicação ao `@react-pdf/renderer` de que o título e a lista devem permanecer juntos. Quando o conteúdo anterior ocupa quase toda a página, o título fica numa página e a lista na seguinte.

### Solução
Envolver o bloco `passedSection` (linhas 480-494) com `<View break={false} minPresenceAhead={80}>` para que o `@react-pdf/renderer` saiba que o título precisa de pelo menos 80pt de conteúdo à frente. Adicionalmente, wrapping the entire passed section in a single `<View wrap={false}>` would be ideal **if** the list is short enough — but with 20+ items it may not fit on one page.

A abordagem correta é:
1. Wrap o título + primeiros itens da lista num `<View minPresenceAhead={120}>` para garantir que o título nunca fique sozinho no fim de uma página
2. Mover o `passedSection` inteiro para uma **nova `<Page>`** dedicada, separando-o da página de "Guia de Correções"

**Abordagem escolhida**: Mover para página própria — é a mais robusta e evita qualquer quebra entre título e lista.

### Alteração em `src/components/pdf/ExternalDomainPDF.tsx`

Extrair o bloco de "Verificações Aprovadas" (linhas 480-494) de dentro da `<Page wrap>` do "Guia de Correções" e colocá-lo numa `<Page>` separada logo após, com `wrap` habilitado para que a lista possa fluir por múltiplas páginas se necessário. O título ficará fixo no topo da nova página.

```
{/* Passed checks - dedicated page */}
{categorizedChecks.passed.length > 0 && (
  <Page size="A4" style={pageStyles.page} wrap>
    <View style={pageStyles.content}>
      <Text style={pageStyles.passedTitle}>
        Verificações Aprovadas ({categorizedChecks.passed.length})
      </Text>
      <View style={pageStyles.passedList}>
        {categorizedChecks.passed.map(...)}
      </View>
    </View>
    <PDFFooter />
  </Page>
)}
```

