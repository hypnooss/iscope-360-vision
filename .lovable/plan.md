

## Correção do Bug: Role Não Salva Corretamente ao Criar/Editar Usuário

### Problema Identificado

O trigger `handle_new_user` executa automaticamente quando um usuário é criado no `auth.users` e sempre insere a role `'user'` na tabela `user_roles`:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES (NEW.id, 'user');  -- Sempre 'user'
```

Logo após, a edge function `create-user` tenta inserir a role correta:

```typescript
await supabaseAdmin.from("user_roles").insert({
  user_id: userId,
  role: role || "user",  // Ex: 'workspace_admin'
});
```

Porém, a tabela `user_roles` possui uma constraint `UNIQUE (user_id)`, causando **violação de constraint** no INSERT da edge function. O erro é logado mas não propagado, então o usuário é criado com a role errada.

### Solução

Modificar a edge function para usar **UPDATE** após o INSERT inicial feito pelo trigger.

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/create-user/index.ts` | Usar UPDATE ao invés de INSERT para definir a role |

---

### Mudança no Código

**Antes (linha 155-163):**
```typescript
// 3. Create role
const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
  user_id: userId,
  role: role || "user",
});

if (roleError) {
  console.error("Error creating role:", roleError);
}
```

**Depois:**
```typescript
// 3. Update role (trigger already inserted 'user' role)
const { error: roleError } = await supabaseAdmin
  .from("user_roles")
  .update({ role: role || "user" })
  .eq("user_id", userId);

if (roleError) {
  console.error("Error updating role:", roleError);
  throw new Error("Failed to set user role: " + roleError.message);
}
```

---

### Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    CRIAÇÃO DE USUÁRIO - FLUXO                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Edge function chama auth.admin.createUser()                     │
│                           │                                         │
│                           ▼                                         │
│  2. Trigger handle_new_user executa:                                │
│     - INSERT profile                                                │
│     - INSERT user_roles (role = 'user')                             │
│     - INSERT user_module_permissions (defaults)                     │
│                           │                                         │
│                           ▼                                         │
│  3. Edge function continua:                                         │
│     - INSERT profile → IGNORA (já existe)                           │
│     - UPDATE user_roles SET role = 'workspace_admin'  ← CORRIGIDO   │
│     - DELETE + INSERT user_clients                                  │
│     - DELETE + INSERT user_modules                                  │
│                           │                                         │
│                           ▼                                         │
│  4. Usuário criado com role CORRETA                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Considerações Adicionais

1. **Edição de usuário (UsersPage.tsx)** - O código atual usa upsert com `onConflict: "user_id,role"`, mas a constraint real é apenas `user_id`. Vamos corrigir isso também:

**Antes (linha 183-191):**
```typescript
await supabase
  .from("user_roles")
  .upsert({ user_id: editingUser.id, role: editRole }, { onConflict: "user_id,role" });

if (editingUser.role !== editRole) {
  await supabase.from("user_roles").delete().eq("user_id", editingUser.id).neq("role", editRole);
}
```

**Depois:**
```typescript
await supabase
  .from("user_roles")
  .update({ role: editRole })
  .eq("user_id", editingUser.id);
```

---

### Seção Técnica

A constraint real é:
```sql
UNIQUE (user_id)  -- Não é (user_id, role)
```

Isso significa que cada usuário pode ter apenas UMA role, então o uso de UPDATE é a abordagem correta.

---

### Estimativa

| Tarefa | Tempo |
|--------|-------|
| Atualizar edge function create-user | 15min |
| Atualizar UsersPage.tsx handleSave | 10min |
| Deploy e testes | 10min |
| **Total** | **~35min** |

