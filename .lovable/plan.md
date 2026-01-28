
# Plano: Corrigir Configuração das Edge Functions para o Agent

## Problema Identificado

O agent Python não consegue se registrar porque as Edge Functions estão bloqueando requisições sem token JWT do Supabase Auth. O erro `401 - Missing authorization header` ocorre **antes** do código da função ser executado.

### Causa Raiz
O arquivo `supabase/config.toml` não inclui `verify_jwt = false` para as funções do agent. Por padrão, o Supabase exige autenticação JWT do Supabase Auth para todas as Edge Functions.

### Funções Afetadas
- `register-agent` - Precisa ser pública (agent ainda não tem token)
- `agent-heartbeat` - Usa JWT próprio do agent
- `agent-refresh` - Usa JWT próprio do agent  
- `agent-tasks` - Usa JWT próprio do agent
- `agent-step-result` - Usa JWT próprio do agent
- `agent-task-result` - Usa JWT próprio do agent

## Solução

### 1. Atualizar `supabase/config.toml`

Adicionar configurações para desabilitar a verificação JWT do Supabase nas funções do agent:

```toml
project_id = "akbosdbyheezghieiefz"

[functions.register-agent]
verify_jwt = false

[functions.agent-heartbeat]
verify_jwt = false

[functions.agent-refresh]
verify_jwt = false

[functions.agent-tasks]
verify_jwt = false

[functions.agent-step-result]
verify_jwt = false

[functions.agent-task-result]
verify_jwt = false
```

### 2. Atualizar `.env.example` do Agent

Corrigir a URL base das Edge Functions:

```
AGENT_API_BASE_URL=https://akbosdbyheezghieiefz.supabase.co/functions/v1
```

## Detalhes Técnicos

### Por que `verify_jwt = false`?

O sistema do agent usa **autenticação JWT própria**:
- O agent recebe um `jwt_secret` único durante o registro
- Os tokens são gerados e verificados pela Edge Function usando esse secret
- Não usa o sistema de autenticação do Supabase Auth

As funções já implementam validação manual:
- `register-agent`: Valida o `activation_code`
- `agent-heartbeat`: Valida o JWT do agent via RPC
- `agent-refresh`: Valida o refresh token do agent

### Segurança

Mesmo com `verify_jwt = false`, as funções são seguras porque:
1. Implementam rate limiting por IP
2. Validam tokens JWT com secrets únicos por agent
3. Verificam status do agent (revogado, expirado, etc.)

## Resultado Esperado

Após as alterações:
1. O agent conseguirá chamar `/register-agent` com o `activation_code`
2. Receberá `access_token` e `refresh_token`
3. Poderá enviar heartbeats e executar tarefas normalmente
