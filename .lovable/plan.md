

# Exibir scans do Attack Surface Analyzer na pagina de Execucoes

## Problema

O scan do Attack Surface Analyzer (`attack-surface-scan`) grava resultados na tabela `attack_surface_snapshots`. A pagina de Execucoes (`ExternalDomainExecutionsPage`) consulta apenas duas fontes:
- `external_domain_analysis_history` (source = 'api')
- `agent_tasks` (target_type = 'external_domain')

Nenhuma dessas tabelas recebe registros do Attack Surface scan, por isso ele nunca aparece na listagem.

## Solucao

Adicionar `attack_surface_snapshots` como terceira fonte de dados na pagina de Execucoes.

### Arquivo: `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`

1. **Nova query**: buscar `attack_surface_snapshots` filtrados por `client_id` (usando os mesmos `workspaceIds` ja disponiveis), com filtros de tempo e status equivalentes.

2. **Novo tipo no `UnifiedExecution`**: adicionar `type: 'attack_surface'` alem de `'api'` e `'agent'`.

3. **Novo badge visual**: criar entrada em `typeConfig` para `attack_surface` com icone `Radar` e cor teal/ciano para diferenciar dos demais.

4. **Merge no `unifiedExecutions`**: mapear cada snapshot para `UnifiedExecution` com:
   - `source: 'attack_surface'`
   - `domainId`: vazio (nao e vinculado a um dominio especifico)
   - `status`: campo `status` do snapshot
   - `duration`: calculado de `created_at` ate `completed_at`
   - Label customizado: "Attack Surface Scan" em vez de nome de dominio

5. **Detalhes ao clicar**: abrir dialog mostrando `summary` (IPs, portas, servicos, CVEs), `score` e timestamp de conclusao.

6. **Polling**: incluir snapshots pendentes/running na logica de refetch automatico (10s).

7. **Filtro de busca**: incluir "attack surface" como termo pesquisavel.

### Secao tecnica

- A query usara os `client_id` dos workspaces acessiveis (mesmo padrao dos dominos)
- Para usuarios nao-super, o `client_id` vira do `user_clients` (ja resolvido no componente)
- O campo `domainId` sera `''` para snapshots do attack surface, e o `getDomainLabel` retornara "Attack Surface Scan" nesse caso
- Nenhuma alteracao no backend ou no edge function e necessaria

