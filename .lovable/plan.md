

# Fix: Steps do Attack Surface falham com "IP address is required"

## Problema

Os executors `masscan`, `nmap` e `httpx` precisam do IP do alvo para funcionar. Cada executor busca o IP em duas fontes:

```
ip = params.get('ip') or context.get('ip')
```

Porem:
1. O blueprint nao inclui `ip` nos `params` de cada step (os steps sao genericos)
2. O `context` e construido pelo `_build_context` a partir do `target`, mas essa funcao nunca extrai `target.ip` para o contexto

O `target` enviado pelo RPC para o Super Agent e:
```
{"id": snapshot_id, "type": "attack_surface", "ip": "187.85.164.49"}
```

Mas `_build_context` nao copia `target['ip']` para `context['ip']`.

## Solucao

Corrigir em **dois pontos** para garantir robustez:

### 1. Python Agent: `_build_context` (arquivo `python-agent/agent/tasks.py`)

Adicionar `ip` ao contexto, extraindo de `target`:

```
context = {
    'base_url': base_url,
    'domain': domain,
    'ip': target.get('ip'),          # <-- ADICIONAR
    'api_key': credentials.get('api_key'),
    ...
}
```

Isso resolve o problema para todos os executors que dependem de `context.get('ip')`.

### 2. SQL RPC: Injetar IP nos params dos steps (opcional, defesa em profundidade)

Na funcao `rpc_get_agent_tasks`, ao construir o blueprint para system agents, injetar o IP de cada task nos params de cada step:

```
'blueprint', json_build_object('steps', (
  SELECT COALESCE(
    (SELECT jsonb_agg(
      step || jsonb_build_object('params', 
        COALESCE(step->'params', '{}'::jsonb) || jsonb_build_object('ip', c.ip)
      )
    ) FROM jsonb_array_elements(db.collection_steps->'steps') AS step),
    '[]'::jsonb
  )
  ...
))
```

Isso garante que cada step ja receba o IP nos seus `params`, mesmo sem depender do contexto.

## Arquivos alterados

1. **`python-agent/agent/tasks.py`** - Adicionar `'ip': target.get('ip')` em `_build_context` (linha 678)
2. **Migration SQL** - Atualizar `rpc_get_agent_tasks` para injetar IP nos params dos steps do attack surface

## Resultado esperado

Apos a correcao:
- Cada step recebe o IP via `params.ip` (injetado pelo RPC)
- O contexto tambem tem `ip` disponivel (fallback via `_build_context`)
- Os executors masscan/nmap/httpx encontram o IP e executam normalmente
- O agent no servidor precisa ser atualizado com o novo `tasks.py`

