

## Excluir guests do cálculo da barra Sign-in habilitado

### Alteração

**`src/components/m365/entra-id/EntraIdCategorySheet.tsx`**, linha 88:

Mudar o denominador de `users.total` para `users.total - users.guests` (apenas membros internos):

```ts
// De:
const enabledPct = users.total > 0 ? (users.signInEnabled / users.total) * 100 : 0;

// Para:
const internalUsers = users.total - users.guests;
const enabledPct = internalUsers > 0 ? (users.signInEnabled / internalUsers) * 100 : 0;
```

Isso faz a barra refletir apenas membros internos (cloud-only + sincronizados), excluindo convidados.

