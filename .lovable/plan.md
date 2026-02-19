
# Correção: Adicionar "hourly" ao Enum `schedule_frequency`

## Causa do Erro

O enum `schedule_frequency` no banco de dados foi criado apenas com os valores `daily`, `weekly` e `monthly`. Ao tentar salvar com frequência `hourly`, o Postgres rejeita com:

```
invalid input value for enum schedule_frequency: "hourly"
```

## Correção

### Migration SQL

```sql
ALTER TYPE public.schedule_frequency ADD VALUE IF NOT EXISTS 'hourly';
```

Essa instrução adiciona o valor `hourly` ao enum existente de forma segura (sem afetar dados existentes).

### Nenhuma alteração de código necessária

O frontend já usa `'hourly'` corretamente — após a migration, o banco passará a aceitar esse valor.

## Arquivo criado

- Nova migration SQL em `supabase/migrations/`
