

## Mover DataSourceDot do subtítulo para cada card de insight

### Problema
O ponto roxo (`analyzed`) está no subtítulo "INSIGHTS DE SEGURANÇA" em vez de estar em cada card individual.

### Alteração em `ExchangeSecurityInsightCards.tsx`

1. **Remover** o `<DataSourceDot source="analyzed" />` da linha 49 (ao lado do título)
2. **Adicionar** `<DataSourceDot source="analyzed" />` dentro de cada card, posicionado no `CardHeader` ao lado do badge de severidade (ou no canto superior direito com `absolute`)

O posicionamento será no header do card, entre o título e o badge de severidade, mantendo consistência visual com os outros cards do dashboard.

