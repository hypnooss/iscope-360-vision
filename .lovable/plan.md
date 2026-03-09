

# Por que todos os agendamentos estão "Atrasado"

## Diagnóstico

O problema **não é de código frontend**. A causa raiz é que a Edge Function `run-scheduled-analyses` está rejeitando as chamadas do cron job com **"Unauthorized call attempt"**.

Nos logs da função (02:00:02 UTC de hoje):
```
WARNING [run-scheduled-analyses] Unauthorized call attempt
```

A função exige autenticação com o **service role key**:
```typescript
if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
  console.warn('[run-scheduled-analyses] Unauthorized call attempt');
  return 401;
}
```

Porém, o cron job no `pg_cron` provavelmente está configurado com o **anon key** no header `Authorization`. Como resultado:

1. O cron dispara a cada minuto
2. A função rejeita a chamada (401)
3. O `next_run_at` nunca é atualizado
4. Todos os agendamentos ficam permanentemente "Atrasado"

## Solução

Atualizar o cron job no Supabase para usar o **service role key** em vez do anon key. Isso precisa ser feito diretamente no banco de dados:

```sql
-- Primeiro, verificar o cron existente:
SELECT * FROM cron.job WHERE jobname LIKE '%scheduled%';

-- Depois atualizar com o service role key correto:
SELECT cron.unschedule('nome-do-job-atual');

SELECT cron.schedule(
  'run-scheduled-analyses',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://akbosdbyheezghieiefz.supabase.co/functions/v1/run-scheduled-analyses',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY_AQUI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

Substitua `SERVICE_ROLE_KEY_AQUI` pelo service role key do projeto Supabase (disponível em Settings > API no dashboard do Supabase).

## Alternativa

Se preferir não mexer no cron agora, posso alterar a função para aceitar também o anon key (menos seguro, pois qualquer pessoa com o anon key poderia disparar as análises).

