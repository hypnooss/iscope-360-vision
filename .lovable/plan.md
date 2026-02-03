
# Plano: Corrigir RLS do Bucket agent-releases

## Problema Identificado

O erro ocorre porque o bucket `agent-releases` possui apenas uma policy de **leitura pública**:

```sql
create policy "Public can read agent releases"
on storage.objects
for select
using (bucket_id = 'agent-releases');
```

Porém, **não existe policy de INSERT/UPDATE** que permita o upload de arquivos. Quando você tenta fazer upload, o Supabase retorna:

```
StorageApiError: new row violates row-level security policy
```

---

## Solução

Criar uma migration que adiciona policies de **INSERT**, **UPDATE** e **DELETE** para o bucket `agent-releases`, permitindo que **Super Admins** façam o gerenciamento dos releases.

---

## Implementação

### Migration SQL

```sql
-- Allow super_admins to upload agent releases
CREATE POLICY "Super admins can upload agent releases"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'agent-releases'
  AND public.has_role(auth.uid(), 'super_admin')
);

-- Allow super_admins to update/overwrite agent releases
CREATE POLICY "Super admins can update agent releases"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'agent-releases'
  AND public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  bucket_id = 'agent-releases'
  AND public.has_role(auth.uid(), 'super_admin')
);

-- Allow super_admins to delete agent releases
CREATE POLICY "Super admins can delete agent releases"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'agent-releases'
  AND public.has_role(auth.uid(), 'super_admin')
);
```

---

## Resumo

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/migrations/xxx.sql` | Criar | Adicionar policies de upload para super_admins |

---

## Resultado Esperado

Após aplicar a migration:
1. Super Admins poderão fazer upload de pacotes `.tar.gz` para o bucket
2. A leitura pública continua funcionando (para agents baixarem)
3. Apenas Super Admins podem gerenciar os releases

---

## Seção Técnica

### Função Utilizada

A policy usa a função `public.has_role(auth.uid(), 'super_admin')` que já existe no sistema para verificar se o usuário autenticado tem a role de super_admin.

### Por que não usar `authenticated`?

Poderíamos usar `auth.role() = 'authenticated'` para permitir qualquer usuário autenticado, mas é mais seguro restringir apenas a Super Admins, já que apenas eles têm acesso à página de configurações.
