
# Plano: Atualizar Código para Novo Supabase

## Resumo

Atualizar as variáveis de ambiente e configurações do projeto para apontar para o novo projeto Supabase `ovctuytroqngojalgjrs` criado pelo usuário.

---

## Alterações Necessárias

### 1. Arquivo `.env`

Atualizar as credenciais do Supabase:

```env
VITE_SUPABASE_PROJECT_ID="ovctuytroqngojalgjrs"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92Y3R1eXRyb3FuZ29qYWxnanJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzg4NzMsImV4cCI6MjA4NDk1NDg3M30.P-Ar5n7JXPJcW8ZXo7AhWWfsjg7wAoE4UUMcxB2MzDU"
VITE_SUPABASE_URL="https://ovctuytroqngojalgjrs.supabase.co"
```

### 2. Arquivo `supabase/config.toml`

Atualizar o `project_id` na primeira linha:

```toml
project_id = "ovctuytroqngojalgjrs"
```

### 3. Arquivo `python-agent/.env.example`

Atualizar a URL base de exemplo:

```env
AGENT_API_BASE_URL=https://ovctuytroqngojalgjrs.supabase.co/functions/v1
```

---

## Detalhes Técnicos

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `.env` | Trocar 3 variáveis para novo projeto |
| `supabase/config.toml` | Trocar `project_id` |
| `python-agent/.env.example` | Trocar URL de exemplo |

### O Que Acontece Após as Alterações

1. O frontend passará a usar o novo banco de dados
2. As Edge Functions serão automaticamente redeployadas para o novo projeto pelo Lovable
3. O Python Agent precisará ser reconfigurado manualmente (`.env` local + reset)

---

## Próximos Passos Após Implementação

1. **Testar Login**: Acessar o sistema e fazer login com `nn.mansberger@gmail.com`
2. **Configurar Secrets**: No Supabase, ir em Settings > Edge Functions e adicionar:
   - `M365_ENCRYPTION_KEY` (posso gerar um novo se precisar)
   - `M365_MULTI_TENANT_APP_ID` (se usar Microsoft 365)
   - `M365_MULTI_TENANT_CLIENT_SECRET` (se usar Microsoft 365)
3. **Reconfigurar Python Agent**: Atualizar `.env` do agent e executar `python main.py --reset-default`

---

## Observações

- O código do cliente Supabase (`src/integrations/supabase/client.ts`) usa as variáveis de ambiente automaticamente, então não precisa ser alterado
- Todas as Edge Functions existentes serão redeployadas automaticamente
- Os dados do banco antigo (Lovable Cloud) permanecem intactos - você pode exportar CSVs de lá se precisar depois
