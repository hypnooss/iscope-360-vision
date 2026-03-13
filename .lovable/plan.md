

## Fix: `hasMfa` deve considerar qualquer método registrado

### Problema
Na Edge Function (linha 310-312), `hasMfa` só é `true` para métodos fortes. Usuários com apenas `mobilePhone` ou `email` recebem `hasMfa: false`, caindo na aba "MFA Desativado" em vez de "MFA Fraco".

### Correção — `supabase/functions/entra-id-dashboard/index.ts` (linha 310-312)

Alterar de:
```typescript
const hasMfa = methods.some((m: string) =>
  ['microsoftAuthenticatorPush', 'softwareOneTimePasscode', ...].includes(m)
);
```

Para:
```typescript
const hasMfa = methods.length > 0;
```

Isso faz com que qualquer usuário com pelo menos um método registrado (incluindo `mobilePhone`, `email`) tenha `hasMfa: true`. O front-end já classifica corretamente esses usuários na aba "MFA Fraco" (métodos todos fracos) vs "MFA Habilitado" (pelo menos um método forte).

Após o deploy, será necessário re-executar a análise do tenant para atualizar o cache.

