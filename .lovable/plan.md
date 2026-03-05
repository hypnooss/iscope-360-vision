

## Fix: Manter título de categoria + card juntos no "Guia de Correções"

### Problema
Na seção "Guia de Correções", cada grupo de categoria tem um título (`categoryHeader`) seguido de cards (`PDFExplanatoryCard`). O título usa `minPresenceAhead={120}` mas isso nem sempre é suficiente — o título pode ficar no fim de uma página com o card na próxima.

### Solução
Envolver cada par de título + primeiro card num `<View wrap={false}>` para que o react-pdf os mantenha juntos. Os cards subsequentes da mesma categoria podem quebrar normalmente.

### Alteração em `src/components/pdf/ExternalDomainPDF.tsx` (linhas 464-488)

Substituir a lógica atual por:

```tsx
{Object.entries(failedByCategory).map(([categoryName, items]) => (
  <View key={categoryName}>
    {items.map((item, index) => {
      const content = getGuideContent(
        item.check.id,
        correctionGuides,
        item.check.name,
        item.check.description,
        item.check.recommendation
      );

      // First item: wrap header + card together
      if (index === 0) {
        return (
          <View key={`${item.check.id}-${index}`} wrap={false}>
            <Text style={pageStyles.categoryHeader}>{categoryName}</Text>
            <PDFExplanatoryCard
              content={content}
              priority={item.priority}
              originalName={item.check.name}
            />
          </View>
        );
      }

      // Subsequent items: just the card (wrap={false} already on the card)
      return (
        <PDFExplanatoryCard
          key={`${item.check.id}-${index}`}
          content={content}
          priority={item.priority}
          originalName={item.check.name}
        />
      );
    })}
  </View>
))}
```

Isso garante que o título de cada categoria sempre aparece na mesma página que seu primeiro card. Os demais cards fluem normalmente.

