

# Filtrar Steps do Blueprint Enviados ao Agent

## Problema

A funcao RPC `rpc_get_agent_tasks` envia **todos** os steps do blueprint "External Domain DNS Scan" para o Agent Python, incluindo os 11 steps com `executor: "edge_function"` (subdomain_securitytrails, subdomain_virustotal, etc.). O Agent nao possui um executor do tipo `edge_function`, gerando o erro "Executor desconhecido: edge_function" para cada um desses steps.

Esses steps de enumeracao de subdominios ja sao executados pela Edge Function `subdomain-enum` (disparada em paralelo pelo `trigger-external-domain-analysis`). Portanto, o Agent deve receber **apenas** os 7 steps DNS (ns_records, mx_records, soa_record, etc.) que possuem `executor: "agent"`.

## Solucao

Filtrar os steps do blueprint **dentro da RPC** antes de enviar ao Agent. Apenas steps com `executor = 'agent'` (ou sem campo `executor` para retrocompatibilidade) devem ser incluidos.

## Mudanca Tecnica

### Migracacao SQL: Alterar `rpc_get_agent_tasks`

Na secao de External Domain da RPC (linhas ~69-81), alterar o `COALESCE` que busca o blueprint para filtrar os steps:

**Antes:**
```text
COALESCE(
  (SELECT db.collection_steps FROM device_blueprints db WHERE ...),
  '{"steps": []}'::jsonb
) as blueprint
```

**Depois:**
```text
COALESCE(
  (
    SELECT jsonb_build_object(
      'steps',
      COALESCE(
        (SELECT jsonb_agg(step)
         FROM jsonb_array_elements(db.collection_steps->'steps') AS step
         WHERE COALESCE(step->>'executor', 'agent') = 'agent'),
        '[]'::jsonb
      )
    )
    FROM device_blueprints db
    WHERE db.device_type_id = (
      SELECT id FROM device_types WHERE code = 'external_domain' AND is_active = true LIMIT 1
    )
    AND db.is_active = true
    ORDER BY db.version DESC
    LIMIT 1
  ),
  '{"steps": []}'::jsonb
) as blueprint
```

Isso filtra o array `steps` para incluir apenas os que tem `executor = 'agent'` ou nao possuem campo `executor` (default agent). Os 11 steps `edge_function` serao removidos da task enviada ao Agent.

Essa mesma filtragem sera aplicada tambem a secao de Firewall e M365 (por seguranca e consistencia), embora hoje esses blueprints nao tenham steps `edge_function`.

## Resultado Esperado

- Agent recebe apenas 7 steps DNS: `ns_records`, `mx_records`, `soa_record`, `spf_record`, `dmarc_record`, `dkim_records`, `dnssec_status`
- Os 11 steps de subdomain continuam sendo executados pela Edge Function `subdomain-enum` via API
- Nenhuma mudanca no Agent Python, Edge Functions ou frontend

## Arquivo Modificado

| Item | Mudanca |
|------|---------|
| Migration SQL (alterar funcao `rpc_get_agent_tasks`) | Filtrar `collection_steps.steps` para incluir apenas `executor = 'agent'` |

