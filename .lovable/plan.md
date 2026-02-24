

# Correcao do Timeout no Upload de Steps com Volume Alto

## Problema Identificado

O log do edge function `agent-step-result` mostra:

```
Failed to insert step result: {
  code: "57014",
  message: "canceling statement due to statement timeout"
}
```

Com a paginacao ativa, o step `allowed_traffic` coletou **2059 registros** (5 paginas). O agente tenta enviar todos esses registros crus num unico POST para `agent-step-result`, que faz um upsert na tabela `task_step_results` com um JSON de varios MB na coluna `data`. O banco de dados nao consegue processar o upsert dentro do timeout padrao e cancela o statement.

Isso tambem explica o delete ausente: o `firewall-analyzer` nao recebe os dados de `allowed_traffic` porque nunca foram persistidos.

## Estrategia de Solucao

### 1. Limitar campos dos logs antes do envio (Agent Python)

**Arquivo:** `python-agent/agent/executors/http_request.py`

Para endpoints de log paginados, aplicar um filtro de campos antes de retornar os resultados. Cada log do FortiGate tem dezenas de campos, mas o `firewall-analyzer` usa apenas um subconjunto. Reduzir o payload mantendo apenas os campos necessarios:

**Campos essenciais por tipo de coleta:**
- Todos: `logid`, `eventtime`, `date`, `time`, `type`, `subtype`, `level`, `action`
- Traffic: `srcip`, `dstip`, `srcport`, `dstport`, `proto`, `service`, `policyid`, `sentbyte`, `rcvdbyte`, `srccountry`, `dstcountry`, `app`, `appcat`, `user`, `srcuser`
- Auth/VPN: `user`, `srcip`, `msg`, `logdesc`, `status`, `reason`, `remip`, `tunneltype`, `group`, `ui`
- Config: `cfgpath`, `cfgobj`, `cfgattr`, `msg`, `logdesc`, `user`, `ui`
- IPS: `srcip`, `dstip`, `attack`, `severity`, `msg`, `ref`
- Web/App: `srcip`, `user`, `srcuser`, `catdesc`, `cat`, `category`, `hostname`, `url`, `app`, `appcat`
- Anomaly: `srcip`, `dstip`, `msg`, `attack`, `ref`

Implementar um metodo `_trim_log_fields` que mantenha um conjunto unificado desses campos (uniao de todos) e descarte o restante. Isso pode reduzir o payload em 60-70%.

### 2. Chunked upload para steps grandes (Agent Python)

**Arquivo:** `python-agent/agent/tasks.py`

Adicionar logica no `_report_step_result` para dividir payloads grandes em chunks:

- Se `data.results` tem mais de 500 registros, dividir em lotes de 500
- Enviar o primeiro lote normalmente via upsert
- Enviar lotes subsequentes com um mecanismo de append (ou enviar apenas o primeiro lote + metadata de paginacao, ja que o `firewall-analyzer` ira reprocessar)

**Alternativa mais simples (preferida):** como o `firewall-analyzer` so precisa dos dados para processar e gerar metricas/insights (nao precisa dos dados brutos depois), podemos simplesmente truncar os resultados armazenados em `task_step_results` a um maximo seguro (ex: 1000 registros) e adicionar metadata `_truncated: true, _original_count: 2059`.

O `firewall-analyzer` ja aplica `filterLogsByTime` + `deduplicateLogs` -- portanto, manter 1000 mais recentes (que ja estao ordenados por tempo pelo FortiGate) e suficiente para capturar a janela real.

### 3. Abordagem combinada (recomendada)

Combinar ambas as estrategias:

1. **Trim de campos** no `http_request.py` -- reduz tamanho de cada registro
2. **Limite de registros** no `_report_step_result` -- limita a 1500 registros por step, com metadata de contagem original
3. Resultado: payloads muito menores que passam no timeout do DB

### 4. Quanto ao delete ausente

O delete pode ter sido perdido porque:
- O step `config_changes` foi processado antes do `allowed_traffic` e pode ter sido enviado corretamente
- Mas o delete pode ter ocorrido **depois** do `period_end` do snapshot (ou seja, fora da janela)
- Precisa confirmar se o delete esta dentro da janela temporal do ultimo snapshot

Uma vez corrigido o timeout, os proximos snapshots capturarao o delete normalmente.

## Arquivos a Alterar

| Arquivo | Alteracao |
|---|---|
| `python-agent/agent/executors/http_request.py` | Adicionar `_trim_log_fields()` para reduzir campos dos logs paginados |
| `python-agent/agent/tasks.py` | Adicionar limite de registros em `_report_step_result` com metadata |
| `python-agent/agent/version.py` | Bump para 1.3.1 |

## Resultado Esperado

| Cenario | Antes | Depois |
|---|---|---|
| allowed_traffic com 2059 registros | Timeout no DB (payload ~5MB+) | Payload reduzido (~1MB) com campos trimados |
| Steps com alto volume | Falha silenciosa, dados perdidos | Upload bem-sucedido com metadata de contagem |
| Config changes/deletes | Podem ser perdidos indiretamente | Processados normalmente |

