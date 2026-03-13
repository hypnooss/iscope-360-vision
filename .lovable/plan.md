

## Nova aba "MFA Fraco" na janela de Cobertura MFA

### O que será feito

Adicionar uma quarta aba entre "MFA Habilitado" e "MFA Desativado" chamada **"MFA Fraco"**, que lista usuários cujos **únicos** métodos registrados são considerados fracos (`mobilePhone`, `email`). Usuários que possuem pelo menos um método forte (Authenticator, FIDO2, Passkey, etc.) não aparecem nessa aba.

### Definição de métodos fracos

```
WEAK_METHODS = ['mobilePhone', 'email']
```

Um usuário é "MFA Fraco" quando:
- `hasMfa === true` (tem MFA)
- **Todos** os seus `methods` estão contidos em `WEAK_METHODS` (nenhum método forte)

### Alteração — `EntraIdCategorySheet.tsx` (caso `mfa_coverage`)

**Filtro (após linha 152):**
```typescript
const WEAK_METHODS = new Set(['mobilePhone', 'email']);
const weakUsers = enabledUsers.filter(
  (u) => u.methods.length > 0 && u.methods.every((m) => WEAK_METHODS.has(m))
);
const strongUsers = enabledUsers.filter(
  (u) => !u.methods.every((m) => WEAK_METHODS.has(m))
);
```

**Tabs (linhas 156-160) — adicionar a nova aba e ajustar contagens:**
- "MFA Habilitado" passa a mostrar `strongUsers` (apenas quem tem pelo menos um método forte)
- Nova aba "MFA Fraco" mostra `weakUsers` com ícone de alerta (cor âmbar)
- "MFA Desativado" permanece igual

```
Status Geral | MFA Habilitado (N) | MFA Fraco (N) | MFA Desativado (N)
```

**TabsContent para a nova aba:**
```tsx
<TabsContent value="weak">
  <MfaUserList users={weakUsers} showMethods />
</TabsContent>
```

A aba "MFA Habilitado" passa a usar `strongUsers` em vez de `enabledUsers`.

### Resultado

- **MFA Habilitado**: usuários com pelo menos um método forte
- **MFA Fraco**: usuários com MFA, mas apenas métodos fracos (Phone/Email)
- **MFA Desativado**: sem MFA

