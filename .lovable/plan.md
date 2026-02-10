

# Alterar cor do "Valor atual" para verde

## Alteracao

No arquivo `src/pages/admin/SettingsPage.tsx`, alterar a cor do texto "Valor atual:" (que exibe o valor mascarado da API key) de `text-muted-foreground` para `text-emerald-400` (verde), mantendo consistencia com o design system do projeto.

## Detalhe tecnico

Localizar o `<span>` que exibe "Valor atual: {maskedValue}" e trocar a classe de cor.

**Arquivo:** `src/pages/admin/SettingsPage.tsx`

De:
```
text-xs text-muted-foreground
```

Para:
```
text-xs text-emerald-400
```

