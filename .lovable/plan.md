

## Correções de Segurança: IDOR nas Trigger Functions + XSS no Service Health

### Correção 1: IDOR — Validação de acesso nas trigger functions

**Problema:** As funções `trigger-firewall-analysis` e `trigger-external-domain-analysis` usam `service_role_key` diretamente, sem verificar se o usuário autenticado tem acesso ao `client_id` do recurso. Qualquer usuário autenticado pode disparar análises em firewalls/domínios de outros clientes.

**Nota:** `trigger-m365-posture-analysis` já valida auth corretamente (usa anon key + `getUser()`), mas não verifica `has_client_access`. `trigger-firewall-analyzer` tem o mesmo problema que as outras duas.

**Solução:** Em cada uma das 3 funções vulneráveis:
1. Extrair o token JWT do header `Authorization`
2. Criar um client Supabase com anon key para validar o usuário (`getUser()`)
3. Após obter o recurso (firewall/domain), chamar `has_client_access(user_id, client_id)` via RPC
4. Retornar 403 se o usuário não tiver acesso

**Funções a modificar:**
- `supabase/functions/trigger-firewall-analysis/index.ts`
- `supabase/functions/trigger-external-domain-analysis/index.ts`
- `supabase/functions/trigger-firewall-analyzer/index.ts`

**Padrão a aplicar (mesmo usado em `trigger-m365-posture-analysis`):**
```typescript
// 1. Validate auth
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return 401 Unauthorized;
}

// 2. Verify user with anon key
const supabaseUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
const { data: { user } } = await supabaseUser.auth.getUser();

// 3. After fetching resource, check access
const supabaseAdmin = createClient(url, serviceRoleKey);
const { data: hasAccess } = await supabaseAdmin.rpc('has_client_access', { 
  _user_id: user.id, _client_id: resource.client_id 
});
if (!hasAccess) return 403 Forbidden;
```

**Para `trigger-m365-posture-analysis`:** Adicionar apenas a verificação `has_client_access` após obter o tenant (linhas 95-106), já que a autenticação de usuário já está implementada.

---

### Correção 2: XSS — Sanitização de HTML do Microsoft Graph

**Problema:** `M365ServiceHealthPage.tsx` linha 635 usa `dangerouslySetInnerHTML` com `post.content` vindo da Microsoft Graph API sem sanitização.

**Solução:**
1. Instalar `dompurify` e `@types/dompurify`
2. Sanitizar o HTML antes de renderizar:
```typescript
import DOMPurify from 'dompurify';
// ...
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
```

**Arquivo a modificar:**
- `src/pages/m365/M365ServiceHealthPage.tsx`

---

### Resumo de arquivos
| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/trigger-firewall-analysis/index.ts` | Adicionar auth + `has_client_access` |
| `supabase/functions/trigger-external-domain-analysis/index.ts` | Adicionar auth + `has_client_access` |
| `supabase/functions/trigger-firewall-analyzer/index.ts` | Adicionar auth + `has_client_access` |
| `supabase/functions/trigger-m365-posture-analysis/index.ts` | Adicionar `has_client_access` (auth já existe) |
| `src/pages/m365/M365ServiceHealthPage.tsx` | Sanitizar HTML com DOMPurify |
| `package.json` | Adicionar `dompurify` + `@types/dompurify` |

