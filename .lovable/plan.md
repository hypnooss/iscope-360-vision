
# Correção do Erro de Agendamento

## Causa do Problema

O código faz um `upsert` com `onConflict: 'client_id'`:
```ts
await supabase
  .from('attack_surface_schedules')
  .upsert(payload, { onConflict: 'client_id' });
```

O PostgreSQL exige que exista uma constraint `UNIQUE` ou `EXCLUSION` na coluna especificada no `ON CONFLICT`. A tabela `attack_surface_schedules` tem `client_id` como campo, mas **não possui** um índice único nessa coluna, causando o erro:

> `there is no unique or exclusion constraint matching the ON CONFLICT specification`

## Solução

Criar uma migration que adiciona um índice único (`UNIQUE INDEX`) na coluna `client_id` da tabela `attack_surface_schedules`. Isso garante:
- Um agendamento por workspace (client)
- O `upsert` com `onConflict: 'client_id'` funciona corretamente

## Migration SQL

```sql
CREATE UNIQUE INDEX IF NOT EXISTS attack_surface_schedules_client_id_key
  ON public.attack_surface_schedules (client_id);
```

## Arquivo Modificado

- Nova migration em `supabase/migrations/`

Nenhuma alteração de código frontend é necessária — apenas a constraint no banco.
