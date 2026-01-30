
## Diagnóstico (por que o erro acontece)
O erro **“new row violates row-level security policy for table external_domains”** significa que o Supabase bloqueou o INSERT por causa das políticas de RLS.

Pelos logs de rede, o app está tentando inserir corretamente:
- `client_id`: 145988e9-14b5-49ca-b1e6-c9184cba86f0
- `agent_id`: 73c20fe9-7d87-47bd-bfa3-7dfc969359d9
- `created_by`: 799901ed-bf94-4076-9ce1-aa9d540c7293 (usuário logado)
- `status`: pending
- domínio e nome ok

A policy criada na migration de `external_domains` exige (WITH CHECK):
- `has_client_access(auth.uid(), client_id)`  ✅ você tem (existe `user_clients` para esse client_id)
- `get_module_permission(auth.uid(), 'external_domain') IN ('edit','full')` ❌ está falhando

O motivo: a função `public.get_module_permission()` (definida em `supabase/migrations/20260112202447_...sql`) busca permissões na tabela `public.user_module_permissions`.  
E, no seu banco, o usuário **super_admin** tem permissões `full` para: `dashboard`, `firewall`, `reports`, `users`, `m365`, mas **não tem linha para `external_domain`**.

Além disso, no frontend, `hasPermission()` retorna **true automaticamente para super_admin**, então o botão aparece mesmo sem existir a linha correspondente no banco, e o INSERT é negado no servidor.

Conclusão: é um desalinhamento entre:
- Frontend: “super_admin sempre pode”
- Backend/RLS: “só pode se `get_module_permission()` retornar edit/full”

Você confirmou que deseja: **super_admin = sempre FULL**. Vamos ajustar o backend para refletir isso.

---

## Objetivo do ajuste
1) Fazer com que **super_admin sempre passe nas policies** que usam `get_module_permission()`, inclusive para módulos novos como `external_domain`.  
2) Opcional (recomendado): também “seedar” a permissão `external_domain` na tabela `user_module_permissions` para consistência e para o frontend exibir corretamente para usuários não-super-admin.

---

## Plano de implementação (backend via migration)
### Etapa 1 — Atualizar a função `public.get_module_permission()`
Criar uma nova migration SQL em `supabase/migrations/` para substituir a função:

Comportamento novo:
- Se `has_role(_user_id, 'super_admin')` → retornar `'full'::module_permission` imediatamente.
- Caso contrário, manter o comportamento atual:
  - procurar em `user_module_permissions`
  - se não existir, default `'view'`

Isso resolve não só `external_domains`, mas qualquer tabela/policy que dependa dessa função.

### Etapa 2 — “Seed”/Backfill de permissões do módulo `external_domain` (recomendado)
Na mesma migration (ou outra), inserir permissões ausentes:

- Para cada usuário com role `super_admin`:
  - garantir que exista `user_module_permissions (user_id, module_name='external_domain', permission='full')`
- Opcional: para usuários não super_admin, se você quiser padrão:
  - inserir `'view'` se não existir (para evitar “buracos” de permissão e deixar o frontend consistente)

Tudo com `INSERT ... SELECT ... WHERE NOT EXISTS (...)` para ser idempotente.

### Etapa 3 — Ajustar `handle_new_user()` para novos usuários (recomendado)
Hoje o trigger `handle_new_user()` cria permissões iniciais, mas não inclui `external_domain`.
Atualizar o trigger para adicionar `external_domain`:
- Primeiro usuário (super_admin): inserir `('external_domain', 'full')`
- Usuários seguintes (role user): inserir `('external_domain', 'view')`

Isso evita que o problema reapareça quando você criar novos usuários no futuro.

---

## Plano de verificação (testes)
### Teste A — Super admin (seu caso)
1. Fazer login novamente (ou “Logout/Login” para garantir sessão fresca).
2. Ir em **Domínio Externo → Domínios Externos**.
3. Adicionar domínio (cliente/agent/domínio) e clicar **Adicionar**.
4. Esperado:
   - Sem erro de RLS
   - Registro aparece na lista
   - Se frequência != manual, schedule também salva

### Teste B — Usuário comum sem edit
1. Logar com usuário que não tem `external_domain` = edit/full.
2. Esperado:
   - Botão não aparece (frontend)
   - Mesmo que tente via API, RLS bloqueia (backend)

### Teste C — Usuário com edit
1. Dar `external_domain=edit` para um usuário via `user_module_permissions`.
2. Esperado:
   - Consegue inserir e listar domínios somente dos clientes aos quais tem acesso (`user_clients`).

---

## Arquivos/partes que serão alterados
- `supabase/migrations/YYYYMMDDHHMMSS_fix_get_module_permission_super_admin.sql`
  - `CREATE OR REPLACE FUNCTION public.get_module_permission(...)`
  - backfill `user_module_permissions` para `external_domain`
  - atualização do `handle_new_user()` (trigger)

Nenhuma mudança no frontend é necessária para corrigir o 403 (o backend passará a aceitar como o UI já sugere). Opcionalmente, depois podemos alinhar o frontend/ModuleContext para usar um único modelo de permissões (mas isso é uma melhoria, não bloqueia o cadastro).

---

## Riscos e cuidados
- Alterar função usada por várias policies pode mudar comportamento esperado para super_admin (mas você explicitamente quer super_admin sempre FULL, então é intencional).
- A migration deve ser idempotente (não criar duplicatas). Vamos usar `WHERE NOT EXISTS`/`ON CONFLICT` conforme o schema permitir.
- Como isso é backend, a mudança aplica imediatamente no ambiente Test; em Live só quando publicar (se você publicar as migrations).

---

## Resultado esperado após o ajuste
- O INSERT em `external_domains` deixa de retornar 403 para super_admin.
- O módulo Domínio Externo passa a funcionar “end-to-end” como o módulo Firewall no que diz respeito a permissões e cadastro.