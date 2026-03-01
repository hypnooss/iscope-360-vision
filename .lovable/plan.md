

## Calcular Score de Risco no Frontend (M365 Analyzer)

### Problema
O campo `score` no snapshot do banco de dados esta sempre `null`/`undefined`, fazendo o risco cair no fallback `0`. Os incidentes criticos e altos aparecem corretamente, mas o score nao reflete a realidade.

### Solucao
Calcular o score no frontend a partir dos insights operacionais filtrados, usando penalidades logaritmicas por severidade (consistente com o padrao de postura M365).

### Alteracao no arquivo `src/pages/m365/M365AnalyzerDashboardPage.tsx`

**1. Adicionar funcao `computeRiskScore`**

Uma funcao que recebe os insights operacionais e calcula um score de 0-100:
- Critical: 15 pontos cada
- High: 8 pontos cada
- Medium: 3 pontos cada
- Low: 1 ponto cada
- Cap em 100

**2. Substituir a leitura do score (linha 500)**

De:
```ts
const score = snapshot?.score ?? 0;
```

Para:
```ts
const score = snapshot?.score ?? computeRiskScore(operationalInsights);
```

Isso garante que se o backend eventualmente calcular o score, ele sera usado. Caso contrario, o frontend calcula com base nos incidentes visiveis.

**Nota**: A ordem das variaveis precisa ser ajustada pois `operationalInsights` e definido na linha 504, depois de `score` na linha 500. Sera necessario mover o calculo de `operationalInsights` para antes da linha do score.
