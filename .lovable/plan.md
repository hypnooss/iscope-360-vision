
# Geolocalização via Agent — Arquitetura Completa

## Problema

O botão "Buscar" chama diretamente a Edge Function `resolve-firewall-geo`, que tenta conectar ao FortiGate **da nuvem Supabase**. Isso é inaceitável: toda comunicação com firewalls deve passar pelo **Agent instalado na rede do cliente**, que já tem acesso direto ao FortiGate e ignora SSL via `requests` + `verify=False` (linha 54 do `http_request.py`).

## Arquitetura da Solução

```text
Usuário clica "Buscar"
        ↓
Frontend cria agent_task tipo "geo_query"
  (target_id = agent_id, payload = { url, api_key_encrypted? })
        ↓
Agent faz polling → recebe task → executa HTTP request ao FortiGate
  (HTTPRequestExecutor, verify_ssl=False, dentro da rede do cliente)
        ↓
Agent envia resultado via agent-task-result (step_results com IPs WAN)
        ↓
Frontend faz polling no status da task (a cada 2s, até 60s)
  ↓                         ↓
result.success             timeout
Mostra dialog ou            Toast de erro
preenche campos
        ↓
ipapi.co é consultado NO FRONTEND com os IPs retornados pelo Agent
(geolocalização pública — sem problema em fazer do browser)
```

## Detalhes Técnicos

### 1 — Novo tipo de task: `geo_query`

A tabela `agent_tasks` usa um enum `agent_task_type`. É necessário adicionar `geo_query` ao enum via migration SQL.

### 2 — Edge Function `resolve-firewall-geo` — Reformulada

A Edge Function deixa de conectar ao FortiGate diretamente. Passa a ser uma **orquestradora de task**:

**Entrada:** `{ agent_id, url, api_key }`

**Fluxo:**
1. Valida que o agent existe e pertence ao cliente do usuário autenticado
2. Cria um `agent_task` do tipo `geo_query` com:
   - `agent_id` = agent selecionado
   - `target_id` = qualquer UUID válido (usaremos o próprio `agent_id` como target temporário)
   - `target_type` = `'agent'`
   - `payload` = `{ url, api_key, action: 'get_wan_ips' }`
   - `expires_at` = now + 5 minutos (task rápida)
3. Retorna `{ task_id }` imediatamente

**Frontend** faz polling nessa task via consulta ao banco (tabela `agent_tasks`) a cada 2s, até `completed` ou timeout de 60s.

### 3 — Agent Python — Novo executor ou lógica no tasks.py

O Agent precisa reconhecer o tipo `geo_query` e executar a lógica correspondente. A abordagem mais limpa é **reutilizar o `HTTPRequestExecutor` existente** via blueprint dinâmico embutido no payload (sem precisar de novo executor).

A task `geo_query` tem em seu `payload` um blueprint inline com dois steps `http_request`:
```json
{
  "steps": [
    {
      "id": "get_interfaces",
      "type": "http_request",
      "config": {
        "method": "GET",
        "path": "/api/v2/cmdb/system/interface",
        "headers": { "Authorization": "Bearer {{credentials.api_key}}" },
        "verify_ssl": false
      }
    },
    {
      "id": "get_sdwan",
      "type": "http_request",
      "config": {
        "method": "GET",
        "path": "/api/v2/cmdb/system/sdwan",
        "headers": { "Authorization": "Bearer {{credentials.api_key}}" },
        "verify_ssl": false,
        "optional": true
      }
    }
  ]
}
```

O Agent já executa esses steps normalmente. O resultado de cada step (`interfaces`, `sdwan`) é salvo em `task_step_results`.

### 4 — Edge Function `resolve-firewall-geo` — Polling do resultado

Após criar a task, o **frontend** faz polling (não a Edge Function):

```typescript
// polling a cada 2s
const result = await supabase
  .from('agent_tasks')
  .select('status, result, step_results')
  .eq('id', taskId)
  .single();

if (result.data?.status === 'completed') {
  // processar IPs WAN dos step_results
}
```

Quando a task completa, o frontend:
1. Lê `task_step_results` para extrair os dados das interfaces
2. Filtra interfaces WAN (lógica JS no frontend, mesma do `resolve-firewall-geo` atual)
3. Consulta `ipapi.co` diretamente do browser para geolocalizar os IPs públicos
4. Exibe o `WanSelectorDialog` se múltiplos IPs, ou preenche direto se único

### 5 — RPC `rpc_get_agent_tasks` — Suporte ao tipo `geo_query`

A RPC atual filtra apenas tasks `target_type = 'firewall'` e `target_type = 'external_domain'` e `target_type = 'm365_tenant'`. Precisamos adicionar um bloco `UNION ALL` para `target_type = 'agent'` (tasks geo_query).

O blueprint para geo_query vem direto do `payload.blueprint` (blueprint inline), não de um `device_blueprint` registrado.

## Fluxo de Dados Completo

```text
Frontend (AddFirewallPage)
  │
  ├─ Clique "Buscar" com agent_id + url + api_key
  │
  ▼
Edge Function resolve-firewall-geo (reformulada)
  ├─ Valida agent pertence ao cliente
  ├─ Cria agent_task { type: geo_query, agent_id, payload: { url, api_key, blueprint } }
  └─ Retorna { task_id }
  │
  ▼
Frontend — polling agent_tasks a cada 2s (até 60s)
  │
  ▼
Agent Python (na rede do cliente)
  ├─ Faz heartbeat → vê pending task geo_query
  ├─ Executa HTTPRequestExecutor → GET /api/v2/cmdb/system/interface (verify_ssl=False)
  ├─ Executa HTTPRequestExecutor → GET /api/v2/cmdb/system/sdwan (optional)
  └─ Reporta resultado via agent-step-result + agent-task-result
  │
  ▼
Frontend detecta task.status === 'completed'
  ├─ Lê step_results → filtra interfaces WAN públicas (JS)
  ├─ Para cada IP público → GET ipapi.co/{ip}/json (do browser)
  └─ 1 IP → preenche campos direto
      N IPs → abre WanSelectorDialog
```

## Arquivos a Modificar/Criar

| Arquivo | Operação | Descrição |
|---|---|---|
| Migration SQL | Criar | Adicionar `geo_query` ao enum `agent_task_type` |
| `supabase/functions/resolve-firewall-geo/index.ts` | Reformular | Criar task no Agent em vez de conectar ao FortiGate |
| DB `rpc_get_agent_tasks` | Atualizar via migration | Adicionar UNION ALL para `target_type = 'agent'` com blueprint inline do payload |
| `src/pages/environment/AddFirewallPage.tsx` | Modificar | Polling, filtro de IPs WAN em JS, geolocalização no browser |

## Considerações sobre Segurança da API Key

A `api_key` vai no `payload` da task (JSONB no banco). O campo já existe em `agent_tasks.payload`. As tasks geo_query têm `expires_at` de 5 minutos e são eliminadas após execução — o risco de exposição é mínimo. Para produção futura, a key poderia ser criptografada via o mesmo AES-256-GCM já usado nas credenciais de firewall, mas para esta task efêmera não é obrigatório.

## Sem mudanças no Python Agent

O Agent Python **não precisa de alterações**. Ele já:
- Lê tasks de `rpc_get_agent_tasks`
- Executa `http_request` steps com `verify_ssl=False`
- Reporta step results via `agent-step-result`

A única mudança necessária é na RPC para incluir tasks do tipo `geo_query`.

