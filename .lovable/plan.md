

## Correcao do Score de Risco no M365 Analyzer

### Problema
O banco de dados armazena `score = 0` (nao `null`) nos snapshots. O operador `??` (nullish coalescing) so faz fallback para `null` ou `undefined`, mas **nao** para `0`. Por isso, o calculo local `computeRiskScore()` nunca e executado.

### Solucao
Alterar a logica na linha 513 de `src/pages/m365/M365AnalyzerDashboardPage.tsx`:

**De:**
```ts
const score = snapshot?.score ?? computeRiskScore(operationalInsights);
```

**Para:**
```ts
const score = snapshot?.score || computeRiskScore(operationalInsights);
```

O operador `||` faz fallback quando o valor e falsy (`0`, `null`, `undefined`), garantindo que o calculo local seja usado sempre que o backend nao fornecer um score real.

### Impacto
- Nenhum efeito colateral: se o backend algum dia calcular um score > 0, ele sera usado.
- Correcao imediata sem necessidade de nova coleta.

