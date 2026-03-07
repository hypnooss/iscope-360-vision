

## Auditoria de Segurança — Vulnerabilidades e Melhorias Identificadas

Após análise completa do projeto, identifiquei **7 problemas de segurança** organizados por severidade.

---

### ALTA SEVERIDADE

#### 1. Edge Function `get-map-config` sem autenticação
A função retorna uma API key (Stadia Maps) descriptografada para **qualquer requisição** — sem verificar `Authorization` header nem identidade do usuário. Qualquer pessoa com a URL pode obter a chave.

**Correção:** Adicionar verificação de autenticação (getUser) antes de retornar a chave.

---

#### 2. Edge Functions de scheduler/queue sem proteção contra chamadas externas
As funções `run-scheduled-analyses` e `run-attack-surface-queue` usam `service_role` diretamente e não validam nenhum header de autorização. Embora sejam funções internas (chamadas por cron), qualquer pessoa que conheça a URL pode dispará-las, causando execução não autorizada de análises e consumo de recursos.

**Correção:** Adicionar validação de um header secreto (ex: `Authorization: Bearer <SERVICE_ROLE_KEY>`) ou verificar que o chamador é um cron job legítimo.

---

#### 3. Política de senha fraca (mínimo 6 caracteres)
Todos os formulários de senha (`Auth.tsx`, `InviteUserDialog.tsx`, `ChangePasswordDialog.tsx`) aceitam senhas de apenas 6 caracteres, sem exigir complexidade (maiúsculas, números, caracteres especiais).

**Correção:** Aumentar para mínimo 12 caracteres e adicionar validação de complexidade:
- Pelo menos 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial
- Aplicar no Zod schema e no Supabase Dashboard (Auth > Password settings)

---

### MÉDIA SEVERIDADE

#### 4. MFA Enroll/Challenge sem proteção de rota
As páginas `/mfa/enroll` e `/mfa/challenge` não verificam se o usuário está autenticado (aal1). Um usuário não logado pode acessar essas rotas e receber erros não tratados das APIs do Supabase MFA.

**Correção:** Adicionar guard nos componentes `MfaEnrollPage` e `MfaChallengePage` para redirecionar para `/auth` se não houver sessão ativa.

---

#### 5. Ausência de rate limiting no login
Não há proteção contra brute-force no formulário de login. Embora o Supabase tenha rate limiting básico, não há feedback ao usuário nem bloqueio progressivo no frontend.

**Correção:** Implementar:
- Contador de tentativas falhas com delay progressivo (1s, 2s, 4s, 8s...)
- Após 5 falhas, bloquear o botão por 30 segundos com countdown
- Registrar tentativas na tabela `rate_limits` já existente

---

#### 6. CORS wildcard (`Access-Control-Allow-Origin: *`) em todas as Edge Functions
Todas as 55+ Edge Functions usam `*` como origin. Isso permite que qualquer site faça requisições autenticadas às suas APIs.

**Correção:** Restringir para os domínios conhecidos:
```typescript
const ALLOWED_ORIGINS = [
  'https://iscope-teste.lovable.app',
  'https://id-preview--80ef3bd6-10e0-4873-8dfe-c2c72619d60b.lovable.app'
];
```
Nota: Embora a autenticação JWT mitigue parte do risco, restringir origins é uma camada adicional de defesa.

---

### BAIXA SEVERIDADE

#### 7. Cache de dados do usuário no sessionStorage
O `AuthContext` armazena profile, role e permissions no `sessionStorage` (cache de 5 minutos). Embora usado apenas para performance e não para decisões de autorização no backend, uma manipulação poderia temporariamente enganar a UI.

**Correção:** Manter o cache, mas garantir que nunca seja usado como fonte de verdade para decisões de segurança (já está correto — RLS e edge functions validam no servidor).

---

### Resumo de Implementação

| # | Severidade | Problema | Arquivos |
|---|-----------|----------|----------|
| 1 | Alta | `get-map-config` sem auth | `supabase/functions/get-map-config/index.ts` |
| 2 | Alta | Schedulers sem proteção | `run-scheduled-analyses`, `run-attack-surface-queue` |
| 3 | Alta | Senha mínima 6 chars | `Auth.tsx`, `InviteUserDialog.tsx`, `ChangePasswordDialog.tsx` |
| 4 | Média | MFA pages sem guard | `MfaEnrollPage.tsx`, `MfaChallengePage.tsx` |
| 5 | Média | Sem rate limit no login | `Auth.tsx` |
| 6 | Média | CORS wildcard | Todas as edge functions |
| 7 | Baixa | Cache sessionStorage | `AuthContext.tsx` (OK, apenas observação) |

### Pontos positivos observados
- Credenciais de firewall criptografadas com AES-256-GCM
- Roles em tabela separada com `SECURITY DEFINER` functions
- RLS policies bem implementadas
- Tokens M365 restritos ao `service_role`
- Autorização agent-client validada no `rpc_get_agent_tasks`
- DOMPurify usado para sanitizar HTML dinâmico
- MFA obrigatório implementado

