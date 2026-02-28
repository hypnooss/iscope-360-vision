

## Correção: Unique constraint em `external_domain_schedules.domain_id`

### Problema
O `ScheduleDialog` usa `upsert(..., { onConflict: 'domain_id' })`, mas a tabela `external_domain_schedules` não tem uma constraint `UNIQUE` na coluna `domain_id`. O Postgres rejeita com: *"there is no unique or exclusion constraint matching the ON CONFLICT specification"*.

### Solução
Adicionar uma constraint `UNIQUE` na coluna `domain_id` via migration SQL:

```sql
ALTER TABLE public.external_domain_schedules
  ADD CONSTRAINT external_domain_schedules_domain_id_key UNIQUE (domain_id);
```

Isso é semanticamente correto — cada domínio deve ter no máximo um agendamento.

### Verificação adicional
Verificar se as outras tabelas de schedule (`analysis_schedules` e `m365_analyzer_schedules`) têm o mesmo problema e corrigir preventivamente se necessário.

