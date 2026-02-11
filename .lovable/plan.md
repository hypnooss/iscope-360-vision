

# Corrigir Execucao de Tarefas SonicWall (http_session)

## Diagnostico

O erro **"No active session. Login step must be executed first."** ocorre em todos os 5 steps do blueprint SonicWall. A causa raiz esta no agente Python (`tasks.py`):

### O que acontece hoje

1. O Blueprint SonicWall define 5 steps com executor `http_session`
2. Cada step tem `config.steps` contendo **sub-steps**: login, request, logout
3. O `TaskExecutor` em `tasks.py` chama `executor.run(step, context)` passando o step inteiro
4. O `HTTPSessionExecutor.run()` procura `step.action` ou `config.action` -- nenhum existe
5. Default para `action = 'request'` e tenta usar uma sessao que nunca foi criada
6. Resultado: todos os 5 steps falham com "No active session"

### Diagrama do fluxo com erro

```text
Blueprint Step (ex: "version"):
  executor: http_session
  config:
    steps:
      [0] auth_login  (POST /api/sonicos/auth)   <-- nunca executado
      [1] request     (GET /api/sonicos/version)  <-- executado, mas sem sessao
      [2] auth_logout (DELETE /api/sonicos/auth)  <-- nunca executado
```

## Solucao

Modificar o `TaskExecutor._execute_single_step()` (bloco de execucao individual em `tasks.py`) para detectar quando um step `http_session` tem `config.steps` e iterar sobre os sub-steps, chamando `executor.run()` para cada um na sequencia, propagando `session_data` no context.

## Arquivo a modificar

| Arquivo | Alteracao |
|---|---|
| `python-agent/agent/tasks.py` | Adicionar logica para expandir sub-steps de `http_session` antes de executar |

## Detalhes tecnicos

No bloco de execucao individual (linhas ~167-308 de `tasks.py`), antes de chamar `executor.run(step, context)`, verificar se o step tem `config.steps`:

```text
Se executor_type == 'http_session' E step.config.steps existir:
    sub_steps = step.config.steps
    Para cada sub_step em sub_steps:
        - Determinar action pelo sub_step.id:
            'auth_login' -> action = 'login'
            'auth_logout' -> action = 'logout'
            outros -> action = 'request'
        - Montar um step sintetico com:
            id = sub_step.id
            action = action determinado
            method = sub_step.method
            path = sub_step.path
            headers = sub_step.headers (merge com step.config.headers)
            body = sub_step.body
            verify_ssl = step.config.verify_ssl
            timeout = step.config.timeout
        - Chamar executor.run(step_sintetico, context)
        - Se retornar session_data, atualizar context
        - Se login falhar, abortar sub-steps restantes
    - O resultado final do step eh o resultado do sub-step 'request'
    - Reportar via progressive upload com step_id do step original
Senao:
    Comportamento atual (chamada direta)
```

### Propagacao de sessao entre steps

Cada step SonicWall faz login/request/logout independentemente (sessao efemera). O `session_data` retornado pelo login (contendo `_session_key`) precisa ser injetado no `context` antes de executar o sub-step `request`. Apos o logout, `_session_key` eh removido do context.

### Dados reportados

Apenas o resultado do sub-step `request` (o que contem os dados reais) sera reportado como resultado do step via `_report_step_result`. Os sub-steps de login/logout sao internos e nao geram registros separados.

### Tratamento de erros

- Se o login falhar: o step inteiro falha com o erro do login
- Se o request falhar: reportar o erro normalmente
- Se o logout falhar: logar warning mas nao falhar o step (dados ja foram coletados)

