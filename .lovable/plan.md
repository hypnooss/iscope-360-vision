

# Completar Infraestrutura do Analyzer: Blueprint + RPC

## O que falta

Duas pecas essenciais para o fluxo funcionar de ponta a ponta:

1. **Blueprint "Analyzer"** na tabela `device_blueprints` com os steps de coleta de logs do FortiGate
2. **Atualizacao da RPC `rpc_get_agent_tasks`** para selecionar o blueprint correto com base no `task_type`

## Problema Atual na RPC

A RPC atual seleciona o blueprint para tasks de firewall assim:

```text
WHERE db.device_type_id = f.device_type_id
  AND db.is_active = true
ORDER BY db.version DESC
LIMIT 1
```

Isso sempre retorna o blueprint de **compliance** (unico existente hoje). Quando tivermos o blueprint **Analyzer** para o mesmo device type, a RPC precisa diferenciar qual blueprint enviar ao agent com base no `task_type`.

## Solucao

### 1. Migracao SQL

**Inserir Blueprint Analyzer** com `executor_type = 'hybrid'` e `name = 'FortiGate - Analyzer'`:

Steps de coleta:
- `denied_traffic`: GET `/api/v2/log/traffic/forward?filter=action==deny&rows=500`
- `auth_events`: GET `/api/v2/log/event/system?filter=logdesc=~auth&rows=500`
- `vpn_events`: GET `/api/v2/log/event/vpn?rows=500`
- `ips_events`: GET `/api/v2/log/ips/forward?filter=severity<=2&rows=500`
- `config_changes`: GET `/api/v2/log/event/system?filter=logdesc=~config&rows=200`

Cada step usa o executor `http_request` (ja suportado pelo agent).

**Atualizar RPC `rpc_get_agent_tasks`**:

Separar a secao de firewall em duas queries:
- Tasks com `task_type != 'firewall_analyzer'` -> seleciona blueprint onde `executor_type IN ('agent')` (compliance)
- Tasks com `task_type = 'firewall_analyzer'` -> seleciona blueprint onde `executor_type IN ('hybrid')` (analyzer)

Ou, de forma mais simples: adicionar um filtro por `executor_type` baseado no `task_type` dentro da subquery do blueprint.

### 2. Arquivos Modificados

Nenhum arquivo de codigo -- apenas migracao SQL:

| Recurso | Alteracao |
|---------|-----------|
| `device_blueprints` (tabela) | INSERT novo blueprint Analyzer |
| `rpc_get_agent_tasks` (funcao) | CREATE OR REPLACE com logica de selecao por task_type |

### 3. Detalhes da RPC Atualizada

A secao de firewall tasks sera modificada para:

```text
-- Subquery do blueprint agora filtra por executor_type baseado no task_type
FROM public.device_blueprints db
WHERE db.device_type_id = f.device_type_id
  AND db.is_active = true
  AND db.executor_type = CASE 
    WHEN t.task_type = 'firewall_analyzer' THEN 'hybrid'
    ELSE 'agent'
  END
ORDER BY db.version DESC
LIMIT 1
```

Isso garante que:
- `firewall_analysis` tasks recebem o blueprint de compliance (`executor_type = 'agent'`)
- `firewall_analyzer` tasks recebem o blueprint de logs (`executor_type = 'hybrid'`)

### 4. Resultado

Apos esta migracao, o fluxo completo estara funcional:
1. Usuario clica "Executar Analise" no dashboard do Analyzer
2. `trigger-firewall-analyzer` cria a task com `task_type = 'firewall_analyzer'`
3. Agent busca tasks via `rpc_get_agent_tasks` e recebe o blueprint correto com steps de coleta de logs
4. Agent executa os steps (HTTP requests ao FortiGate)
5. Agent envia resultados via `agent-task-result`
6. `agent-task-result` chama `firewall-analyzer` Edge Function
7. Insights sao salvos em `analyzer_snapshots`
8. Frontend exibe o dashboard

