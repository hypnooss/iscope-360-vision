
# Correção: Blueprint steps com executor `http_request` não são enviados ao Agent

## Problema identificado

A função RPC `rpc_get_agent_tasks` filtra os steps do blueprint usando:

```sql
WHERE COALESCE(step->>'executor', 'agent') = 'agent'
```

Porém, todos os 23 steps do blueprint "FortiGate - Coleta Padrão" usam `executor: http_request`. Como `http_request` != `agent`, a RPC retorna **zero steps** para o agent. O agent recebe a task sem steps, reporta `completed` imediatamente, e nenhum dado é coletado -- logo nenhum relatório é gerado.

Isso afeta **todos os firewalls FortiGate** que usam esse blueprint.

## Causa raiz

O executor `http_request` é um tipo de executor que roda **dentro do agent Python** (o agent faz chamadas HTTP à API do FortiGate). A RPC deveria considerar os tipos de executor que executam no agent: `agent`, `http_request`, `ssh`, `snmp`, `dns_query`.

Apenas `edge_function` deveria ser excluído (pois roda no Supabase Edge).

## Solução

Alterar a RPC `rpc_get_agent_tasks` para incluir todos os executores que rodam no agent, em vez de filtrar apenas por `executor = 'agent'`.

### Alteração na RPC (migration SQL)

Em todos os 3 blocos da RPC (firewall, external_domain, m365_tenant), substituir o filtro:

```sql
-- De:
WHERE COALESCE(step->>'executor', 'agent') = 'agent'

-- Para:
WHERE COALESCE(step->>'executor', 'agent') NOT IN ('edge_function')
```

Isso usa uma abordagem de **exclusão** em vez de inclusão: qualquer executor que **não** seja `edge_function` será enviado ao agent. Isso é mais seguro para o futuro, pois novos tipos de executor criados para o agent serão automaticamente incluídos.

## Impacto

- Corrige a coleta de dados para todos os firewalls FortiGate
- Mantém compatibilidade com external_domain e m365_tenant (cujos steps já podem ter executor `agent` ou outros tipos)
- Nenhuma alteração no código do agent Python necessária
- Nenhuma alteração no frontend necessária

## Teste

Após aplicar a migration, basta disparar uma nova análise no firewall OCI-FW. O agent receberá os 23 steps e executará a coleta normalmente.
