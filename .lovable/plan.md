

## Problema: Cache do Exchange Dashboard não é populado em execuções agendadas

### Causa Raiz

A edge function `exchange-dashboard` (linhas 108-112) valida o token de autenticação chamando `supabaseAuth.auth.getUser()`. Quando chamada pelo scheduler (`run-scheduled-analyses`), o header Authorization contém a **service_role key**, não um JWT de usuário. O `getUser()` falha com service_role keys, retornando 401 — o cache nunca é gravado.

O mesmo problema afeta `entra-id-dashboard` e `collaboration-dashboard` (provavelmente seguem o mesmo padrão de autenticação).

### Correção

Atualizar a `exchange-dashboard` (e as demais funções de dashboard) para aceitar chamadas com service_role key, além do JWT de usuário:

```ts
// Antes (linhas 103-112):
const authHeader = req.headers.get('Authorization');
if (!authHeader) { return 401; }
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { ... });
const { data: { user }, error } = await supabaseAuth.auth.getUser();
if (authError || !user) { return 401; }

// Depois:
const authHeader = req.headers.get('Authorization');
if (!authHeader) { return 401; }

const token = authHeader.replace('Bearer ', '');
let isServiceRole = (token === supabaseServiceKey);

if (!isServiceRole) {
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { ... });
  const { data: { user }, error } = await supabaseAuth.auth.getUser();
  if (error || !user) { return 401; }
}
```

Também adicionar `success: true` na resposta (linha 389) para que o scheduler não faça retry desnecessário.

### Funções a Atualizar

| Edge Function | Alteração |
|---|---|
| `exchange-dashboard` | Aceitar service_role key + adicionar `success: true` |
| `entra-id-dashboard` | Verificar e aplicar mesmo fix se necessário |
| `collaboration-dashboard` | Verificar e aplicar mesmo fix se necessário |

### Após Deploy

- As execuções agendadas passarão a popular o cache corretamente
- A próxima execução agendada ou manual preencherá os dados nas telas

