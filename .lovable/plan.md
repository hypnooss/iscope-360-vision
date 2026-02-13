

# Fix: Score Atual = Ultimo Score Coletado (nao media)

## Problema

O "Score Atual" calcula a **media aritmetica** dos scores mais recentes de todos os ativos do modulo. O sparkline mostra a **media diaria historica**. Isso cria situacoes impossiveis visualmente:
- Dominio Externo: sparkline vermelho (historico ruim) mas score verde 89 (media atual alta)
- Microsoft 365: sparkline verde (historico bom) mas score vermelho 56 (media atual baixa)

## Solucao

Mudar a logica: o "Score Atual" sera o **score da analise mais recente** do modulo (ultimo valor coletado), nao a media de todos os ativos.

Quando ha multiplos ativos (ex: 3 firewalls), usar o score da analise que tem o `created_at` / `analyzed_at` mais recente entre todos os ativos daquele modulo.

## Alteracoes

### Arquivo: `src/hooks/useDashboardStats.ts`

**Firewall (linhas 182-196)**: Em vez de coletar todos os scores e fazer `avgScores(scores)`, identificar o registro com `analyzed_at` mais recente e usar seu score diretamente:

```typescript
// De:
for (const s of fwSummaries) {
  scores.push(s.score);
  // ...
}
fwHealth.score = avgScores(scores);

// Para:
let latestScore: number | null = null;
for (const s of fwSummaries) {
  if (!latestDate || s.analyzed_at > latestDate) {
    latestDate = s.analyzed_at;
    latestScore = s.score;
  }
  // severidades continuam somando normalmente
}
fwHealth.score = latestScore;
```

**M365 (linhas 208-238)**: Mesmo padrao. A query ja vem ordenada por `created_at DESC`, entao o primeiro registro nao-visto e o mais recente por tenant. Se ha multiplos tenants, pegar o score do tenant com analise mais recente:

```typescript
// De:
m365Health.score = avgScores(scores);

// Para: usar o score do registro mais recente
// (ja identificado pelo latestDate)
```

**External Domain (linhas 250-271)**: Mesmo padrao do Firewall via RPC:

```typescript
// De:
extHealth.score = avgScores(scores);

// Para:
// Usar o score do registro com analyzed_at mais recente
```

**Remover a funcao `avgScores`** (linhas 56-58) pois nao sera mais utilizada.

## Resultado esperado

- Score Atual refletira exatamente o ultimo valor coletado
- O sparkline continuara mostrando o historico diario (media por dia)
- A cor do score e a tendencia do grafico serao consistentes visualmente

## Arquivo alterado

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useDashboardStats.ts` | Score = ultimo coletado em vez de media; remover avgScores |

