

# Exibir contagem real de alterações de config (30 dias) no card do Analyzer

## Contexto

Atualmente o card "Alterações de Config" no grid do Analyzer exibe `metrics.configChanges`, que vem do snapshot (últimas 24h). A página dedicada `/scope-firewall/analyzer/config-changes` consulta a tabela `analyzer_config_changes` com filtro de 30 dias, mostrando um volume muito maior.

A pergunta é: **podemos exibir no card a contagem real dos últimos 30 dias (da tabela) em vez da contagem do snapshot?**

## Resposta: Sim, é possível

### Abordagem

1. **No `AnalyzerDashboardV2Page`**: Adicionar uma query ao `analyzer_config_changes` com `count: 'exact'` e filtro de 30 dias para o firewall selecionado. Isso retorna apenas o total, sem carregar linhas.

2. **Passar o total como prop** ao `AnalyzerCategoryGrid` (ex: `configChangesTotal30d`).

3. **No `AnalyzerCategoryGrid`**: No `case 'config_changes'`, usar o valor recebido por prop (30 dias) em vez de `metrics.configChanges` (snapshot). Se a prop não estiver disponível, fallback para o valor do snapshot.

### Detalhes técnicos

- Query leve: `select('id', { count: 'exact', head: true }).eq('firewall_id', firewallId).gte('changed_at', thirtyDaysAgo)` — retorna apenas o count, zero dados transferidos.
- A query roda em paralelo com o carregamento do snapshot, sem impacto em performance.
- O card continua navegando para a página dedicada ao ser clicado (comportamento atual mantido).

### Arquivos alterados

- `src/pages/firewall/AnalyzerDashboardV2Page.tsx` — nova query de contagem
- `src/components/firewall/AnalyzerCategoryGrid.tsx` — nova prop opcional + uso no case `config_changes`

