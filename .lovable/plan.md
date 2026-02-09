
# Fix: Exibir todos os insights nas categorias do Exchange Online

## Problema

O componente `M365CategorySection` conta TODOS os insights no badge ("6 verificacoes"), mas so renderiza os que tem `status === 'fail'` ou `status === 'pass'`. Insights com status `warn` ou `unknown` sao contados mas nao exibidos, gerando divergencia visual.

Alem disso, ha uma inconsistencia de mapeamento: o hook retorna `'warn'`, mas a pagina tenta mapear para `'warning'` -- nenhum dos dois e reconhecido pelo componente de renderizacao.

## Solucao

### 1. `src/components/m365/posture/M365CategorySection.tsx`

Adicionar renderizacao dos insights com status `warning`/`warn`/`unknown` junto com os demais. A ordem de exibicao sera:

1. `fail` (primeiro, sao os mais criticos)
2. `warn` / `warning` (alertas)
3. `pass` (aprovados)

Alterar as linhas 53-54 e 142-148:

```typescript
const failedInsights = insights.filter(i => i.status === 'fail');
const warningInsights = insights.filter(i => i.status === 'warning' || i.status === 'warn');
const passedInsights = insights.filter(i => i.status === 'pass');
const otherInsights = insights.filter(i => 
  i.status !== 'fail' && i.status !== 'pass' && i.status !== 'warning' && i.status !== 'warn'
);

// Na renderizacao:
{failedInsights.map(...)}
{warningInsights.map(...)}
{otherInsights.map(...)}
{passedInsights.map(...)}
```

### 2. `src/pages/m365/ExchangeOnlinePage.tsx`

Corrigir o mapeamento de status na linha 95 para usar `'warn'` em vez de `'warning'`, mantendo consistencia com o tipo definido no hook (`'pass' | 'fail' | 'warn' | 'unknown'`):

```typescript
status: insight.status === 'pass' ? 'pass' : insight.status === 'fail' ? 'fail' : insight.status === 'warn' ? 'warn' : 'warning',
```

Na verdade, como o tipo `M365Insight.status` aceita `'pass' | 'fail' | 'warning'`, e o hook retorna `'warn'`, o mapeamento correto e preservar o valor original do insight e garantir que o componente renderize todos.

## Resultado

Todos os insights serao exibidos nas suas categorias, eliminando a divergencia entre o contador do badge e os cards renderizados.
