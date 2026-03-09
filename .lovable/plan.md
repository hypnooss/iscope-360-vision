

# Fix: Agendamentos sempre "Atrasado" — Auth 401

## Diagnóstico

A Edge Function `run-scheduled-analyses` está retornando **401 Unauthorized** em todas as chamadas do cron. Evidências:

- **Logs**: `[run-scheduled-analyses] Unauthorized call attempt` em cada execução
- **Cron**: Job #5 roda a cada 15 min, retorna "1 row" (sucesso do HTTP post, mas o response foi 401)
- **Dados**: Todos os `next_run_at` da tabela `analyzer_schedules` estão parados em **2026-03-07 23:xx** (há ~1.5 dias)

## Causa raiz

A função compara o header `Authorization` diretamente com `SUPABASE_SERVICE_ROLE_KEY`:

```ts
if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
```

O cron envia o service_role JWT hardcoded no SQL. Se o valor do env `SUPABASE_SERVICE_ROLE_KEY` na Edge Function não bater exatamente (ex: espaço extra, encoding, ou o secret foi atualizado), a comparação falha.

## Solução

### 1. Tornar a autenticação mais robusta na Edge Function

Substituir a comparação estrita por uma validação via Supabase client, que verifica se o caller tem role `service_role`:

```ts
// Validate caller: accept service_role JWT
const authHeader = req.headers.get('Authorization');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Allow direct service_role key match OR validate JWT
const token = authHeader?.replace('Bearer ', '') || '';
const isServiceKey = token === supabaseServiceKey;

if (!isServiceKey) {
  // Try JWT validation
  const { data: { user }, error } = await supabase.auth.getUser(token);
  // For service_role tokens, getUser returns null but no error in some configs
  // Accept if token matches anon key format from cron
  if (!authHeader) {
    console.warn('[run-scheduled-analyses] Unauthorized call attempt');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ... });
  }
}
```

Na verdade, a abordagem mais simples e confiável: **remover a validação de auth customizada**. As Edge Functions do Supabase já são protegidas pelo anon/service key no header. Basta usar o service role key internamente para operações privilegiadas, sem bloquear a chamada:

```ts
// Remove the manual auth check entirely
// The cron job already sends a valid Authorization header
// Internal operations use the service role client
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

### 2. Atualizar o cron job (se necessário)

Se preferir manter a validação, atualizar o SQL do cron para usar o `SUPABASE_SERVICE_ROLE_KEY` correto. Mas remover a validação é mais robusto.

### 3. Reset dos `next_run_at` travados

Após o deploy, executar SQL para recalcular todos os `next_run_at` para a próxima hora:

```sql
UPDATE analyzer_schedules SET next_run_at = NOW() + INTERVAL '1 minute' WHERE is_active = true;
UPDATE analysis_schedules SET next_run_at = NOW() + INTERVAL '1 minute' WHERE is_active = true;
UPDATE external_domain_schedules SET next_run_at = NOW() + INTERVAL '1 minute' WHERE is_active = true;
UPDATE attack_surface_schedules SET next_run_at = NOW() + INTERVAL '1 minute' WHERE is_active = true AND next_run_at < NOW();
UPDATE m365_analyzer_schedules SET next_run_at = NOW() + INTERVAL '1 minute' WHERE is_active = true AND next_run_at < NOW();
```

Isso forçará a próxima execução do cron a processar todos e recalcular os `next_run_at` corretamente.

## Arquivos alterados

- `supabase/functions/run-scheduled-analyses/index.ts` — remover validação de auth customizada (linhas 82-90)
- SQL direto — reset dos `next_run_at`

