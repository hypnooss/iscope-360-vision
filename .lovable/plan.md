

## Diagnóstico

O problema é um conflito entre as políticas RLS de storage:

- **INSERT/UPDATE/DELETE**: permitem `super_admin` via `has_role()` ✅
- **SELECT**: foi alterado para exigir `service_role` apenas ❌

Quando o upload usa `upsert: true`, o Storage precisa fazer um SELECT para verificar se o arquivo já existe. Como o SELECT só permite `service_role`, o upsert falha mesmo para `super_admin`.

## Correção

Criar uma migration que adiciona uma política SELECT para `super_admin` no bucket `agent-releases`:

```sql
CREATE POLICY "Super admins can read agent releases"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'agent-releases'
  AND public.has_role(auth.uid(), 'super_admin')
);
```

Isso permite que super_admins façam SELECT (necessário para upsert) mantendo o bucket privado para outros usuários.

## Implementação

1. Criar migration SQL com a nova política SELECT para super_admin no bucket agent-releases

