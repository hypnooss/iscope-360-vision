
# Correção do Erro ao Salvar Agendamento

## Causa do Erro

O erro `there is no unique or exclusion constraint matching the ON CONFLICT specification` ocorre porque a tabela `analyzer_schedules` não tem uma constraint `UNIQUE` na coluna `firewall_id`.

O código faz um `upsert` com `{ onConflict: 'firewall_id' }`, mas o banco de dados não sabe que `firewall_id` deve ser único — por isso a operação falha.

## Correção

### 1. Migration — adicionar UNIQUE constraint

Criar uma migration SQL que adiciona o índice único na tabela:

```sql
ALTER TABLE public.analyzer_schedules
  ADD CONSTRAINT analyzer_schedules_firewall_id_key UNIQUE (firewall_id);
```

Isso garante que cada firewall tenha no máximo um registro de agendamento do Analyzer, e permite que o `upsert` funcione corretamente.

### 2. Nenhuma alteração de código necessária

O `handleSaveSchedule` já usa `onConflict: 'firewall_id'` corretamente — após a migration, ele passará a funcionar sem nenhuma mudança no frontend.

## Arquivo modificado

- Nova migration SQL em `supabase/migrations/`
