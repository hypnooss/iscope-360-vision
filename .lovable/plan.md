

## Implementação de MFA Obrigatório (TOTP) + Logout Global

### Visão Geral
Implementar MFA obrigatório usando TOTP nativo do Supabase. Após o login com senha, o sistema verificará se o usuário tem MFA configurado. Se não, exibirá tela de enrollment (QR code). Se sim, pedirá o código de 6 dígitos. Uma edge function será criada para deslogar todos os usuários.

### Arquivos a criar

**1. `src/pages/MfaEnrollPage.tsx`** — Tela de registro do MFA
- Chama `supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'iScope 360' })`
- Exibe QR code (`factor.totp.qr_code`) para o usuário escanear com Google Authenticator / Microsoft Authenticator
- Campo de 6 dígitos (usando o componente `InputOTP` já existente) para verificar o código
- Chama `challengeAndVerify` para validar e ativar o fator
- Redireciona para `/dashboard` após sucesso

**2. `src/pages/MfaChallengePage.tsx`** — Tela de desafio MFA (login com fator já registrado)
- Lista os fatores TOTP do usuário via `supabase.auth.mfa.listFactors()`
- Cria challenge via `supabase.auth.mfa.challenge({ factorId })`
- Campo de 6 dígitos para o código
- Verifica via `supabase.auth.mfa.verify({ factorId, challengeId, code })`
- Redireciona para `/dashboard` após sucesso

**3. `supabase/functions/force-logout-all/index.ts`** — Edge function para deslogar todos
- Protegida: só super_admin pode chamar
- Lista todos os usuários via `auth.admin.listUsers()`
- Chama `auth.admin.signOut(userId, 'global')` para cada um
- Retorna contagem de sessões encerradas

### Arquivos a modificar

**4. `src/contexts/AuthContext.tsx`**
- Adicionar estado `mfaRequired: boolean` e `mfaEnrolled: boolean`
- Após login com sucesso, verificar AAL:
  - `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` retorna `currentLevel` e `nextLevel`
  - Se `nextLevel === 'aal2'` e `currentLevel === 'aal1'` → MFA necessário
- Expor `mfaRequired` e `mfaEnrolled` no contexto

**5. `src/pages/Auth.tsx`**
- Após `signIn` com sucesso, verificar fatores MFA:
  - Se não tem fator TOTP → redirecionar para `/mfa/enroll`
  - Se tem fator TOTP mas está em `aal1` → redirecionar para `/mfa/challenge`
  - Se já está em `aal2` → redirecionar para `/dashboard`

**6. `src/App.tsx`**
- Adicionar rotas `/mfa/enroll` e `/mfa/challenge`
- Proteger rotas autenticadas: se `mfaRequired === true`, redirecionar para a tela MFA correspondente

**7. `supabase/config.toml`**
- Adicionar `[functions.force-logout-all]` com `verify_jwt = false`

### Fluxo do Usuário

```text
Login (senha) 
  → Verificar fatores MFA
    → Sem fator TOTP → /mfa/enroll (QR code + verificação)
    → Com fator TOTP → /mfa/challenge (código 6 dígitos)
  → Sessão aal2 → /dashboard
```

### Logout global
Após implementar, executarei a edge function `force-logout-all` para encerrar todas as sessões ativas, forçando todos os usuários a passarem pelo novo fluxo MFA no próximo login.

### Resumo de arquivos
| Arquivo | Ação |
|---------|------|
| `src/pages/MfaEnrollPage.tsx` | Criar |
| `src/pages/MfaChallengePage.tsx` | Criar |
| `supabase/functions/force-logout-all/index.ts` | Criar |
| `src/contexts/AuthContext.tsx` | Modificar — adicionar verificação AAL |
| `src/pages/Auth.tsx` | Modificar — redirecionar para MFA após login |
| `src/App.tsx` | Modificar — adicionar rotas MFA + guard |
| `supabase/config.toml` | Modificar — adicionar config da nova function |

