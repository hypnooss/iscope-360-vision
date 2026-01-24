
# Plano: Corrigir Leitura do Campo `action` no HTTPSessionExecutor

## Problema Identificado

O executor `http_session` não consegue identificar corretamente a ação (`login`, `request`, `logout`) porque:

1. O blueprint define o campo `action` **no nível do step**
2. O executor Python procura o campo `action` **dentro de `config`**

### Estrutura Atual no Blueprint
```json
{
  "id": "auth_login",
  "type": "http_session",
  "action": "login",     // <-- Nível do step
  "method": "POST",
  "path": "/api/sonicos/auth"
}
```

### Código Atual no Executor
```python
config = step.get('config', {})  # config = {}
action = config.get('action', 'request')  # Sempre retorna 'request'!
```

Como `config` é um dicionário vazio (o blueprint não usa essa estrutura), o `action` sempre fica como `'request'` (default), causando o erro "No active session found" no login.

---

## Solução

Modificar o executor `http_session.py` para ler o `action` diretamente do step, com fallback para o config:

```python
# Antes (incorreto)
config = step.get('config', {})
action = config.get('action', 'request')

# Depois (correto - suporta ambas estruturas)
config = step.get('config', {})
action = step.get('action') or config.get('action', 'request')
```

---

## Alteração Técnica

### Arquivo: `python-agent/agent/executors/http_session.py`

Modificar o método `run()` (linhas 64-66):

```python
def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    config = step.get('config', {})
    step_id = step.get('id', 'unknown')
    # Suporta 'action' no nível do step OU dentro de config
    action = step.get('action') or config.get('action', 'request')
```

Também precisa atualizar os métodos internos para ler outros campos (`method`, `path`, `headers`) diretamente do step quando não existir `config`:

```python
def _do_login(self, step_id: str, config: Dict[str, Any], context: Dict[str, Any], step: Dict[str, Any]) -> Dict[str, Any]:
    method = step.get('method') or config.get('method', 'POST')
    path = step.get('path') or config.get('path', '/api/sonicos/auth')
    headers = step.get('headers') or config.get('headers', {})
    # ... resto do método
```

---

## Problema Secundário: Steps Intermediários

Os steps intermediários (`system_status`, `gateway_av`, etc.) usam `type: http_request` com `use_session: true`. Isso não funciona porque o `HTTPRequestExecutor` não compartilha sessões com `HTTPSessionExecutor`.

### Opções de Solução

1. **Alterar o blueprint** para usar `type: http_session` em todos os steps
2. **Ou** modificar o `TaskExecutor` para converter automaticamente steps com `use_session: true` para `http_session`

A opção 2 é mais robusta e não requer nova migração SQL.

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `python-agent/agent/executors/http_session.py` | Ler `action`, `method`, `path`, `headers` do nível do step (com fallback para config) |
| `python-agent/agent/tasks.py` | Converter automaticamente steps com `use_session: true` para executor `http_session` |

---

## Resultado Esperado

Após as correções:
1. Step `auth_login` será corretamente identificado como ação `login` e criará a sessão
2. Steps intermediários usarão a sessão estabelecida
3. Step `auth_logout` encerrará a sessão corretamente
4. Análise do SonicWall funcionará completamente
