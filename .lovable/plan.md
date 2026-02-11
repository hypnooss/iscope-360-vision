

# Bug: Analyzer gera relatório de Compliance indevidamente

## Causa Raiz

No arquivo `supabase/functions/agent-task-result/index.ts`, apos o bloco do Analyzer (linha ~4193) processar corretamente os logs e enviar para a edge function `firewall-analyzer`, o codigo **continua executando** e cai no bloco generico de compliance (linha ~4322):

```text
if ((body.status === 'completed' || body.status === 'partial') && rawData) {
    // Carrega compliance rules do FortiGate
    // Executa processComplianceRules() nos dados de LOG do analyzer
    // Gera relatório de compliance FALSO
    // Salva em analysis_history
    // Atualiza last_score e last_analysis_at do firewall
}
```

Este bloco verifica apenas `target_type === 'firewall'` mas **NAO verifica o `task_type`**. Como o analyzer tambem tem `target_type = 'firewall'`, ele entra neste bloco e tenta avaliar os dados de log (denied_traffic, auth_events, etc.) contra as regras de compliance (system_status, firewall_policy, etc.), gerando um relatorio invalido.

## Consequencias do Bug

1. Um relatorio de compliance **falso** e salvo em `analysis_history` a cada execucao do analyzer
2. O `last_score` e `last_analysis_at` do firewall sao sobrescritos com valores incorretos
3. Um alerta de sistema "Analise Concluida" e criado incorretamente

## Correcao

Adicionar uma condicao para **excluir** o `task_type = 'firewall_analyzer'` do bloco de processamento de compliance.

### Arquivo: `supabase/functions/agent-task-result/index.ts`

**Linha ~4323** - Alterar de:

```typescript
if ((body.status === 'completed' || body.status === 'partial') && rawData) {
```

Para:

```typescript
if ((body.status === 'completed' || body.status === 'partial') && rawData && task.task_type !== 'firewall_analyzer') {
```

Esta unica condicao adicional garante que:
- Tasks de compliance (`firewall_analysis`) continuam gerando relatorio normalmente
- Tasks do analyzer (`firewall_analyzer`) processam apenas via edge function dedicada, sem gerar relatorio de compliance falso
- Tasks de external domain e M365 nao sao afetadas

## Resumo

| Recurso | Alteracao |
|---------|-----------|
| `supabase/functions/agent-task-result/index.ts` | Adicionar `&& task.task_type !== 'firewall_analyzer'` na condicao da linha ~4323 |

Uma linha de codigo resolve o problema.

