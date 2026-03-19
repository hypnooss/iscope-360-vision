## Problema: Tasks pendentes não expiram automaticamente

### Causa raiz
1. `expires_at` é apenas um timestamp — não aciona mudança de status automaticamente
2. O cleanup no `trigger-firewall-analyzer` rodava **depois** da verificação de agent offline, então com agent offline as tasks nunca eram limpas
3. Não existia rotina global periódica para limpar tasks expiradas

### Correções implementadas

#### 1. Reordenação do cleanup (trigger-firewall-analyzer)
- Cleanup de tasks expiradas e snapshots órfãos agora roda **antes** da verificação de agent offline
- Mesmo com agent offline, tentativas de trigger limpam o passivo

#### 2. Edge Function global: `cleanup-expired-tasks`
- Limpa **todas** as `agent_tasks` expiradas (qualquer task_type)
- Limpa snapshots órfãos de `analyzer_snapshots` e `m365_analyzer_snapshots`
- Pronta para ser chamada via cron a cada 5 minutos

#### 3. UI: TaskExecutionsPage
- `hasActiveTasks` agora ignora tasks pendentes com `expires_at` já vencido

#### 4. Pendente: Configurar cron job
Executar no SQL Editor do Supabase:
```sql
SELECT cron.schedule(
  'cleanup-expired-tasks-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://akbosdbyheezghieiefz.supabase.co/functions/v1/cleanup-expired-tasks',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrYm9zZGJ5aGVlemdoaWVpZWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTEyODAsImV4cCI6MjA4NTE4NzI4MH0.9n-nUenSCwYIGztsfgVAbgis9wEakQDKX3Oe2xBiNvo"}'::jsonb,
    body:='{"time": "now"}'::jsonb
  ) AS request_id;
  $$
);
```
