

# Filtrar seletor de Data para mostrar apenas source: agent

## Resumo

O seletor de Data na tela de Compliance exibe entradas duplicadas porque a query busca todos os registros de `external_domain_analysis_history` (tanto `source: api` quanto `source: agent`). O relatorio de compliance e gerado apenas pelo registro `source: agent`. A solucao e filtrar a query para trazer apenas `source: agent`.

## Mudancas

### Arquivo: `src/pages/external-domain/ExternalDomainReportsPage.tsx`

**1. Filtrar query por `source: agent`** (linha 130-134)

Adicionar `.eq('source', 'agent')` na query de `external_domain_analysis_history` dentro de `fetchReports`. Isso elimina os registros `source: api` que nao contem dados de compliance.

**2. Atualizar badge de contagem de analises** (linha 588)

O texto `{group.analyses.length} analise(s)` agora refletira corretamente o numero de execucoes de compliance (sem duplicatas).

**3. Atualizar stats cards**

Os contadores de status (pendente, executando, concluida, falha) passam a refletir apenas as execucoes de compliance, sem contar as coletas de subdominio separadamente.

## Detalhe tecnico

Unica mudanca de codigo: adicionar `.eq('source', 'agent')` na linha 133, antes do `.order(...)`:

```text
const { data: historyData } = await supabase
  .from('external_domain_analysis_history')
  .select('id, domain_id, score, created_at, status, completed_at')
  .in('domain_id', domainIds)
  .eq('source', 'agent')           // <-- adicionar esta linha
  .order('created_at', { ascending: false });
```

Nenhuma outra mudanca e necessaria. O restante do codigo (agrupamento, seletor, stats, botoes) ja funciona corretamente com a lista filtrada.

