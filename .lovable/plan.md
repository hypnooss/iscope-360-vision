

## Plano: Ajustar `next_run_at` das CVE sources para refletir a realidade

### Diagnóstico

O cron `refresh-cve-cache-daily` roda **1x por dia** (às 06:00 UTC), mas a Edge Function processa **1 fonte por vez** e seta `next_run_at` para **+1 hora**. Como o cron só volta 24h depois, todas as fontes ficam com `next_run_at` vencido → "Atrasado".

### Correção

**`supabase/functions/refresh-cve-cache/index.ts`** — alterar as 3 ocorrências de:
```typescript
next_run_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()  // +1h
```
para:
```typescript
next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()  // +24h
```

Linhas afetadas: ~632, ~646, ~655 (partial sync, full sync, e error).

### Impacto
- 1 arquivo editado, 3 linhas alteradas
- As fontes passarão a mostrar "em cerca de X horas" em vez de "Atrasado"
- Nenhuma mudança no frontend ou no cron

