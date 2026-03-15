

## Corrigir inconsistência entre card "Sem MFA" (43) e sheet (29)

### Causa Raiz

No backend (`entra-id-dashboard/index.ts`), há duas definições conflitantes de "MFA habilitado":

- **`mfaEnabled`** (linha 246): conta apenas métodos **fortes** (Authenticator, FIDO, etc.)
- **`hasMfa`** no `userDetails` (linha 394): `methods.length > 0` — qualquer método

Resultado: `mfa.disabled = total - mfaEnabled = 76 - 33 = 43` (inclui 14 usuários com MFA fraco). Mas o sheet filtra por `!hasMfa` e mostra 29 (correto).

### Solução

Alinhar o cálculo de `mfaEnabled`/`mfaDisabled` no backend com a lógica de `hasMfa` (qualquer método registrado), e adicionar campos `strong` e `weak` separados para o card de splits:

| Arquivo | Alteração |
|---|---|
| `supabase/functions/entra-id-dashboard/index.ts` | `mfaEnabled` = usuários com qualquer método. Adicionar `mfaStrong` e `mfaWeak` ao response. |
| `src/hooks/useEntraIdDashboard.ts` | Adicionar `strong` e `weak` ao tipo `mfa` |
| `src/components/m365/entra-id/EntraIdAnalyzerCategoryGrid.tsx` | Usar `mfa.strong`/`mfa.weak` nos splits em vez de calcular localmente |

### Código Backend (linhas 246-252)

```typescript
// Conta qualquer método = hasMfa
const mfaEnabled = mfaUsers.filter((u: any) => {
  const methods = u.methodsRegistered || [];
  return methods.length > 0;
}).length;
const mfaDisabled = mfaUsers.length - mfaEnabled;

// Strong vs Weak breakdown
const STRONG_METHODS = ['microsoftAuthenticatorPush', 'softwareOneTimePasscode', 'hardwareOneTimePasscode', 'windowsHelloForBusiness', 'passKeyDeviceBound', 'microsoftAuthenticatorPasswordless', 'fido2'];
const mfaStrong = mfaUsers.filter((u: any) => {
  const methods = u.methodsRegistered || [];
  return methods.some((m: string) => STRONG_METHODS.includes(m));
}).length;
const mfaWeak = mfaEnabled - mfaStrong;
```

Response MFA object adiciona `strong: mfaStrong, weak: mfaWeak`.

### Resultado

- Card "Sem MFA": 29 (alinhado com sheet)
- Card "MFA Forte": 33, "MFA Fraco": 14 (mantidos)
- Stats cards e AuthPostureCard: `mfa.enabled` = 47 (todos com algum MFA)

