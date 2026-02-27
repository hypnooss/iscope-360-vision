

## Diagnóstico

O erro `StorageApiError: new row violates row-level security policy` ocorre ao tentar fazer upload para o bucket `agent-releases`. As políticas RLS exigem que o usuário tenha a role `super_admin` na tabela `user_roles`.

Apenas dois usuários possuem `super_admin`:
- `nn.mansberger@gmail.com` (799901ed)
- `thiago.monteiro@precisio.io` (231e3b44)

Se o usuário logado não for um destes, o upload será bloqueado pela RLS.

Além disso, não existe `iscope-agent-latest.tar.gz` no bucket (apenas os versionados), então o upload do "latest" também falha como INSERT.

## Ação necessária

**Opção 1 — Verificar login**: Confirme se está logado com um dos usuários `super_admin` listados acima. Se não estiver, faça login com um deles.

**Opção 2 — Adicionar `super_admin` ao usuário atual**: Se o usuário logado é quem deve ter acesso, precisamos criar uma migration para inserir a role na tabela `user_roles`:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = '<email_do_usuario_logado>'
ON CONFLICT DO NOTHING;
```

## Implementação

1. **Criar migration SQL** para adicionar `super_admin` ao usuário correto (se necessário)
2. Nenhuma alteração de código frontend é necessária — a lógica de upload e as RLS policies estão corretas

Preciso saber: com qual email você está logado para confirmar se é uma questão de permissão?

