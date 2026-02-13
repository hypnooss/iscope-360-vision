

# Fix: Sparkline mostrando cor errada vs Score Atual

## Causa raiz

O dominio `taschibra.com.br` tem multiplas analises por dia. Exemplo do dia 13/02:
- Score 27 (analise parcial/intermediaria)
- Score 89 (resultado final)

A funcao `aggregateScoreHistory` faz a **media**: `(27+89)/2 = 58`, que e pintado de vermelho/amarelo. Enquanto o Score Atual mostra corretamente 89 (o ultimo valor).

## Solucao

### 1. `aggregateScoreHistory` - usar ultimo score do dia (nao media)

**Arquivo**: `src/hooks/useDashboardStats.ts`

Mudar a logica de agregacao: em vez de coletar todos os scores do dia e calcular a media, usar o **ultimo score registrado** naquele dia (que representa o resultado final da analise).

```typescript
// De: media de todos os scores do dia
dayMap.get(day)!.push(r.score);
// score: Math.round(scores.reduce(...) / scores.length)

// Para: ultimo score do dia (substituir se mais recente)
dayMap.set(day, r.score);  // como os dados vem ordenados por created_at ASC, o ultimo sobrescreve
```

### 2. Sparkline - cor uniforme baseada no score atual

**Arquivo**: `src/components/dashboard/ScoreSparkline.tsx`

Mudar o gradiente de cores: em vez de colorir cada ponto individualmente (criando trechos vermelhos e verdes na mesma linha), usar uma **cor unica** baseada no ultimo ponto de dado (que coincide com o Score Atual).

Isso garante que se o Score Atual e verde (89), toda a linha do sparkline sera verde. A **forma** do grafico ainda mostra a evolucao, mas a cor representa o estado atual.

```typescript
// De: gradiente por ponto
return sortedData.map((point, i) => ({
  offset: `${(i / lastIndex) * 100}%`,
  color: getColorForScore(point.score),
}));

// Para: cor unica do ultimo ponto
const lastColor = getColorForScore(sortedData[sortedData.length - 1].score);
// usar lastColor para stroke e fill
```

## Resultado esperado

- Sparkline do Dominio Externo: linha VERDE (score atual 89) mostrando a evolucao correta (sem scores intermediarios de 27/30)
- Sparkline do Microsoft 365: linha com cor correspondente ao score atual
- Consistencia visual total entre cor do grafico e cor do Score Atual

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useDashboardStats.ts` | aggregateScoreHistory usa ultimo score do dia |
| `src/components/dashboard/ScoreSparkline.tsx` | Cor uniforme baseada no score atual |

