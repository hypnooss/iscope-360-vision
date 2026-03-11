

## Diagnóstico: Config Changes Não Coletadas (Mesmo com Fallback)

### Causa Raiz Identificada

O fallback **não foi acionado** porque a memória retornou 3 registros. O problema está na **ordem das operações**:

```text
1. HTTP Executor (http_request.py):
   GET /api/v2/log/memory/event/system/?filter=subtype==system&rows=500
   → Retornou 3 logs (admin login events, NÃO config changes)
   → 3 > 0, portanto: SEM FALLBACK para disco

2. Agent (tasks.py, linha 293-307):
   Pre-filter: manter apenas logs com cfgpath
   → 3 logs → 0 logs (nenhum tinha cfgpath)
   → Envia 0 config changes para o edge function

3. Edge Function (firewall-analyzer):
   → Recebe 0 config changes → configChanges: 0
```

O endpoint `config_changes` e `auth_events` usam o **mesmo endpoint** (`/api/v2/log/event/system?filter=subtype==system`). Na memória, só havia 3 logs de login admin. Os logs de alteração de config (com `cfgpath`) provavelmente estão apenas no **disco**, mas o fallback nunca foi acionado porque o HTTP executor viu "3 resultados" e considerou sucesso.

### Solução

Mover a lógica de fallback para **depois do pre-filter** em `tasks.py`, especificamente para o step `config_changes`:

**Arquivo: `python-agent/agent/tasks.py`** (linhas ~293-307)

Após o pre-filter do `config_changes` resultar em 0 logs, verificar se o step tem `fallback_path` e, se sim, re-executar o request usando o path de disco. Aplicar o pre-filter novamente no resultado do disco.

```text
Fluxo corrigido:

1. HTTP Executor: GET memory → 3 logs
2. Pre-filter cfgpath → 0 logs
3. fallback_path existe? SIM
4. HTTP Executor: GET disk (usando fallback_path) → N logs
5. Pre-filter cfgpath → config changes reais do disco
6. Envia resultado ao edge function
```

**Mudanças necessárias em `python-agent/agent/tasks.py`:**
- Após o bloco de pre-filter (linha ~307), adicionar verificação: se `len(filtered) == 0` e o step config tem `fallback_path`, re-executar o executor com o `fallback_path` como path, aplicar o pre-filter no novo resultado, e usar esse resultado como `step_data`
- Isso requer acesso ao `executor`, `step` e `context` que já estão disponíveis no escopo

**Mudança na versão:** Incrementar para `1.3.9` em `python-agent/agent/version.py`.

### Arquivos a Modificar
- `python-agent/agent/tasks.py` — fallback pós-pre-filter para config_changes
- `python-agent/agent/version.py` — versão 1.3.9

