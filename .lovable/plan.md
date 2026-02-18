
# Fix: Botão "Buscar" não funciona — Dois Problemas

## Diagnóstico Completo

### Causa Real #1 — Blueprint usa campo `url` mas o executor espera `path`

O `HTTPRequestExecutor` do Agent Python lê `config.path` para construir a URL:
```python
# http_request.py linha 44
path = config.get('path', '/')
url = f"{base_url}{path}"
```

Mas a Edge Function `resolve-firewall-geo` gera a blueprint com o campo `url` (URL absoluta):
```json
{
  "config": {
    "url": "https://10.11.70.1:3443/api/v2/cmdb/system/interface"
  }
}
```

O executor ignora o campo `url` e usa `path = '/'` (valor padrão), fazendo GET na raiz do servidor. O FortiGate responde com HTTP 200 + HTML da página de login — que o Agent considera "sucesso" (sem erro HTTP). Por isso o log mostra `status=completed, completed=2, failed=0`, mas os dados são HTML inútil.

**A correção é adaptar a blueprint para usar `path` e passar a URL base no contexto,** OU adaptar o executor para aceitar `url` absoluta quando presente.

A solução mais simples e sem alterar o Python agent é: na blueprint, separar o `base_url` do `path`, passando-os como contexto. Mas o blueprint inline não tem contexto separado.

**A solução correta** é modificar o `HTTPRequestExecutor` para verificar se existe o campo `url` no config (URL absoluta) e usá-lo diretamente, ignorando o `base_url` do contexto. Isso é retrocompatível: blueprints existentes continuam usando `path`, e a nova `geo_query` passa `url` completa.

### Causa Real #2 — Frontend lê coluna errada

O frontend faz polling em:
```typescript
supabase.from('agent_tasks').select('status, result, step_results, ...')
```

Mas os step results são salvos em uma **tabela separada** `task_step_results`, não na coluna `step_results` de `agent_tasks`. A coluna `step_results` fica nula (`<nil>` confirmado no banco). O frontend precisa buscar de `task_step_results` após a task completar.

## Confirmação dos Dados

Consultando o banco com o task_id real (`98f80d1b-20c7-4600-910c-f865c875199c`):
- `agent_tasks.step_results`: **null**
- `task_step_results`: **2 rows**, ambas com `data.raw_text` = HTML da página de login do FortiGate

## Solução

### Mudança 1 — Python Agent: `http_request.py`

Adicionar suporte ao campo `url` absoluta no config. Se `config.url` estiver presente, usar diretamente sem concatenar `base_url`:

```python
# Prioriza URL absoluta se fornecida no config
absolute_url = config.get('url')
if absolute_url:
    url = self._interpolate(absolute_url, context)
else:
    path = config.get('path', '/')
    path = self._interpolate(path, context)
    url = f"{base_url}{path}"
```

### Mudança 2 — Frontend: `AddFirewallPage.tsx`

Após a task completar, buscar step results da tabela `task_step_results`:

```typescript
const { data: stepRows } = await supabase
  .from('task_step_results')
  .select('step_id, status, data')
  .eq('task_id', taskId);

// Montar objeto { get_interfaces: ..., get_sdwan: ... }
const stepResultsMap = Object.fromEntries(
  (stepRows || []).map(r => [r.step_id, r.data])
);
const interfacesData = stepResultsMap['get_interfaces'];
```

Além disso, adicionar validação para detectar HTML (resposta de login) e mostrar mensagem de erro clara:
```typescript
// Detectar se a resposta é HTML em vez de JSON
const isHtmlResponse = (data: any) => 
  data?.raw_text && typeof data.raw_text === 'string' && data.raw_text.trim().startsWith('<!DOCTYPE');

if (isHtmlResponse(interfacesData)) {
  toast.error('O FortiGate retornou página de login. Verifique a API Key e se o token tem permissão de acesso via REST API.');
  return;
}
```

## Arquivos Modificados

| Arquivo | Operação | Descrição |
|---|---|---|
| `python-agent/agent/executors/http_request.py` | Modificar | Suporte ao campo `url` absoluta no config do step |
| `src/pages/environment/AddFirewallPage.tsx` | Modificar | Polling correto via `task_step_results` + detecção de HTML |

## Resultado Esperado

1. Agent faz GET para `https://10.11.70.1:3443/api/v2/cmdb/system/interface` com a API key correta
2. FortiGate retorna JSON com as interfaces (se a API key for válida)
3. Frontend lê os dados de `task_step_results` corretamente
4. Frontend detecta se a resposta é HTML (API key inválida) e exibe erro claro
5. Se os dados forem válidos, filtra interfaces WAN e geolocaliza via ipapi.co
