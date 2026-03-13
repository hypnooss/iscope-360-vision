

## Adicionar breakdown de métodos MFA à Distribuição MFA

### Contexto
A edge function já busca `userRegistrationDetails` da Graph API, que inclui `methodsRegistered` por usuário (ex: `microsoftAuthenticatorPush`, `softwareOneTimePasscode`, `mobilePhone`, etc.). Atualmente só conta "com MFA" vs "sem MFA". Precisamos agregar por método.

### Alterações

#### 1. Edge Function (`supabase/functions/entra-id-dashboard/index.ts`)
Após o cálculo de `mfaEnabled`/`mfaDisabled` (linhas 202-210), agregar contagem por método:

```typescript
const mfaMethodCounts: Record<string, number> = {};
mfaUsers.forEach((u: any) => {
  (u.methodsRegistered || []).forEach((m: string) => {
    mfaMethodCounts[m] = (mfaMethodCounts[m] || 0) + 1;
  });
});
```

Adicionar `methodBreakdown` ao objeto `result.mfa`:
```typescript
mfa: {
  total: mfaUsers.length,
  enabled: mfaEnabled,
  disabled: mfaDisabled,
  methodBreakdown: mfaMethodCounts, // ex: { microsoftAuthenticatorPush: 45, softwareOneTimePasscode: 12, mobilePhone: 30 }
}
```

#### 2. Hook type (`src/hooks/useEntraIdDashboard.ts`)
Adicionar `methodBreakdown` à interface `mfa`:
```typescript
mfa: { total: number; enabled: number; disabled: number; methodBreakdown: Record<string, number> };
```
E no `mapResultToData`, garantir fallback: `methodBreakdown: result.mfa?.methodBreakdown || {}`.

#### 3. Sheet UI (`src/components/m365/entra-id/EntraIdCategorySheet.tsx`)
No `case 'mfa_coverage'`, na seção "Distribuição MFA":
- Adicionar cards de métrica para cada método com labels legíveis:
  - `microsoftAuthenticatorPush` → "Microsoft Authenticator"
  - `softwareOneTimePasscode` → "Software OTP"
  - `mobilePhone` → "Mobile Phone"
  - `email` → "Email"
  - `windowsHelloForBusiness` → "Windows Hello"
  - `passKeyDeviceBound` → "Passkey"
  - etc.
- Substituir a `ProportionalBar` atual (Com MFA / Sem MFA) por uma barra proporcional baseada nos métodos, cada um com uma cor distinta.

Layout:
```text
[Badge: Distribuição MFA]
[Authenticator: 45] [Software OTP: 12] [Mobile Phone: 30] [Sem MFA: 8]
[ProportionalBar: segmentos por método + sem MFA]
```

### Arquivos modificados
1. `supabase/functions/entra-id-dashboard/index.ts` — agregar `methodBreakdown`
2. `src/hooks/useEntraIdDashboard.ts` — tipo + fallback
3. `src/components/m365/entra-id/EntraIdCategorySheet.tsx` — cards + barra por método

