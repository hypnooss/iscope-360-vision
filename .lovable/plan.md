
# Habilitar Dados de Tráfego de Saída: Top IPs e Top Países - Tráfego

## Diagnóstico

O problema está no blueprint do agente FortiGate (Analyzer). Atualmente o blueprint coleta apenas:

- `denied_traffic` → `/api/v2/log/memory/traffic/forward?filter=action==deny`

Não existe nenhum step para tráfego **permitido de saída**. A edge function `firewall-analyzer` tenta compensar filtrando ações `accept` do `denied_traffic`, mas como o endpoint já filtra por `action==deny`, nunca retorna logs permitidos.

Resultado: `topOutboundIPs`, `topOutboundBlockedIPs`, `topOutboundCountries` e `topOutboundBlockedCountries` ficam sempre vazios.

## O que precisa ser adicionado

### 1. Novo step no blueprint FortiGate Analyzer (banco de dados)

Adicionar um step `allowed_traffic` no blueprint `hybrid` do FortiGate:

```
GET /api/v2/log/memory/traffic/forward?filter=action==accept&rows=500&extra=country_id
```

Este endpoint retorna os logs de tráfego forward **permitidos** — que são exatamente os dados de saída permitida. O step existente de `denied_traffic` já captura as saídas bloqueadas (com `action==deny`).

A edge function já sabe processar `allowed_traffic` (linha 1056):
```ts
const allowedData = raw_data.allowed_traffic?.data || raw_data.allowed_traffic || [];
```

Portanto **a edge function não precisa de nenhuma mudança** — ela já está preparada para receber esses dados.

### Estratégia de update no blueprint

O blueprint está salvo em `device_blueprints` como JSONB. A query de migração vai fazer um UPDATE adicionando o novo step ao array `collection_steps.steps`.

## Mudança necessária

Apenas **1 mudança**: adicionar o step `allowed_traffic` ao blueprint `hybrid` do FortiGate no banco de dados via migration SQL.

```sql
UPDATE device_blueprints
SET collection_steps = jsonb_set(
  collection_steps,
  '{steps}',
  (collection_steps->'steps') || '[{
    "id": "allowed_traffic",
    "executor": "http_request",
    "config": {
      "method": "GET",
      "path": "/api/v2/log/memory/traffic/forward?filter=action==accept&rows=500&extra=country_id",
      "headers": { "Authorization": "Bearer {{api_key}}" },
      "verify_ssl": false,
      "optional": true
    }
  }]'::jsonb
)
WHERE id IN (
  SELECT db.id 
  FROM device_blueprints db
  JOIN device_types dt ON db.device_type_id = dt.id
  WHERE dt.code = 'fortigate'
    AND db.is_active = true
    AND db.executor_type = 'hybrid'
);
```

Nenhuma alteração de edge function, hook ou componente frontend necessária.

## Resultado esperado após a mudança

Na próxima execução do analyzer, o agente vai:
1. Coletar `denied_traffic` (tráfego negado — saída bloqueada)
2. Coletar `allowed_traffic` (tráfego aceito — saída permitida) ← **novo**
3. Enviar os dois datasets para a edge function
4. A edge function processa e salva `topOutboundIPs`, `topOutboundCountries`, `topOutboundBlockedIPs`, `topOutboundBlockedCountries` com dados reais

As tabelas "Top IPs - Tráfego" e "Top Países - Tráfego" vão exibir dados nas abas "Saída Permitida" e "Saída Bloqueada".

## Arquivos a modificar

| Recurso | Mudança |
|---|---|
| `device_blueprints` (banco) | Adicionar step `allowed_traffic` via migration SQL |

Nenhum arquivo de código frontend ou edge function precisa ser alterado.
