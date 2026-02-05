

## Correção: Role Não Salva ao Editar Usuário

### Problema Identificado

Ao investigar o banco de dados, encontrei **5 usuários sem role na tabela `user_roles`**:

| Email | ID |
|-------|-----|
| admin@taschibra.com.br | cd8a938c-... |
| admin@nexta.com.br | 2e1da6a9-... |
| admin@estrela.com.br | 5e1a04a4-... |
| admin@iemadeira.com.br | 627b89aa-... |
| admin@precisio.global | eedec5c2-... |

**Causa raiz:**
1. A edge function `create-user` cria o usuário via `auth.admin.createUser()`
2. O trigger `handle_new_user` deveria inserir automaticamente a role `'user'` na tabela `user_roles`
3. Por algum motivo (erro de RLS ou timing), o trigger não inseriu as roles
4. Quando o admin tenta atualizar a role, o `.update()` não encontra nenhuma linha para modificar
5. O Supabase retorna 204 (sucesso) mesmo sem atualizar nada

---

### Solução

Alterar o código para usar **UPSERT** ao invés de **UPDATE**, garantindo que a role seja criada caso não exista.

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/UsersPage.tsx` | Usar upsert com conflito em `user_id` |
| `supabase/functions/create-user/index.ts` | Usar upsert ao invés de update |

---

### Detalhamento das Mudanças

#### 1. UsersPage.tsx - handleSave

**Antes:**
```typescript
await supabase
  .from("user_roles")
  .update({ role: editRole })
  .eq("user_id", editingUser.id);
```

**Depois:**
```typescript
// Use upsert to handle case where role doesn't exist
const { error: roleError } = await supabase
  .from("user_roles")
  .upsert(
    { user_id: editingUser.id, role: editRole },
    { onConflict: "user_id" }
  );

if (roleError) {
  throw new Error("Erro ao atualizar role: " + roleError.message);
}
```

#### 2. Edge function create-user/index.ts

**Antes:**
```typescript
const { error: roleError } = await supabaseAdmin
  .from("user_roles")
  .update({ role: role || "user" })
  .eq("user_id", userId);
```

**Depois:**
```typescript
// Use upsert in case trigger didn't create the role
const { error: roleError } = await supabaseAdmin
  .from("user_roles")
  .upsert(
    { user_id: userId, role: role || "user" },
    { onConflict: "user_id" }
  );
```

---

### Correção dos Dados Existentes

Também precisamos inserir as roles para os usuários que estão sem:

```sql
INSERT INTO user_roles (user_id, role)
SELECT p.id, 'user'::app_role
FROM profiles p
LEFT JOIN user_roles ur ON p.id = ur.user_id
WHERE ur.user_id IS NULL;
```

---

### Seção Técnica

**Por que UPDATE falha silenciosamente:**

O Supabase (PostgREST) retorna 204 No Content quando um UPDATE não encontra linhas que correspondam ao filtro. Isso não é considerado erro, mas simplesmente "0 linhas atualizadas".

**Por que UPSERT resolve:**

`UPSERT` (INSERT ... ON CONFLICT DO UPDATE) garante que:
- Se a linha existe → atualiza
- Se a linha não existe → insere

O `onConflict: "user_id"` indica qual constraint usar para detectar conflitos (a constraint UNIQUE em `user_id`).

---

### Estimativa

| Tarefa | Tempo |
|--------|-------|
| Atualizar UsersPage.tsx | 10min |
| Atualizar edge function | 10min |
| Inserir roles faltantes no banco | 5min |
| Deploy e testes | 10min |
| **Total** | **~35min** |

