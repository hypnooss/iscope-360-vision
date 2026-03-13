

## Evidenciar método MFA padrão (default) na janela de Cobertura MFA

### Contexto
A Graph API retorna o campo `systemPreferredAuthenticationMethods` em cada registro de `userRegistrationDetails`, que indica o(s) método(s) preferidos do sistema para aquele usuário. Atualmente, a Edge Function `entra-id-dashboard` não inclui esse campo no mapeamento de `userDetails`.

### Alterações

**1. Edge Function — `supabase/functions/entra-id-dashboard/index.ts`**
- No mapeamento de `mfa.userDetails` (linha ~308-318), adicionar o campo `defaultMethod` extraído de `u.systemPreferredAuthenticationMethods?.[0] || null`.

**2. Tipos — `src/hooks/useEntraIdDashboard.ts`**
- Adicionar `defaultMethod?: string | null` à interface `MfaUserDetail` dentro do tipo `mfa.userDetails`.

**3. Componente — `src/components/m365/entra-id/MfaUserList.tsx`**
- Atualizar a interface `MfaUserDetail` para incluir `defaultMethod?: string | null`.
- Na renderização das badges de métodos, comparar cada método com `user.defaultMethod`. Se for o método default, usar uma variante visual diferente — badge com cor de destaque (ex: `bg-primary/20 text-primary border-primary/30`) e adicionar um indicador como "(padrão)" ou um ícone de estrela ao lado do label.

### Resultado visual
- Badges normais: estilo `secondary` atual (cinza)
- Badge do método default: cor de destaque (azul/primary) com texto "(padrão)" ou ícone, destacando visualmente qual é o método preferido do sistema para cada usuário

