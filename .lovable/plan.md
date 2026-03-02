

## Diagnóstico — Permissões falsamente marcadas como "granted"

### Causa Raiz

O fix anterior adicionou `isMissingRoles` apenas no `isSecurityLicenseIssue`, mas o problema é que **`isKnownLicenseError`** (linha 797-803) tem a condição `lowerCode === 'forbidden'` que é avaliada **antes** no `if`:

```
if (isKnownLicenseError || isSecurityLicenseIssue || isAdminLicenseIssue)
```

O error code retornado pelo Azure para `SecurityAlert.Read.All` é `"Forbidden"` — que casa com `lowerCode === 'forbidden'`, marcando como `granted` antes de qualquer outra verificação. O `isMissingRoles` no `isSecurityLicenseIssue` nunca chega a ser avaliado porque o short-circuit do `||` já resolveu na primeira condição.

Da mesma forma, `isAdminLicenseIssue` não exclui `isMissingRoles`, o que pode afetar endpoints de SharePoint/beta.

### Dados Confirmados (posture analysis mais recente)

```
security_alerts_v2: 403, code="Forbidden", message="Missing application roles. API required: SecurityAlert.Read.All..."
security_incidents: 403, code="Forbidden", message="Missing application roles. API required: SecurityIncident.Read.All..."
```

Ambos exibidos como "granted" na tela de permissões. O token confirma que essas permissões **não existem** — a lista de application roles no token não inclui `SecurityAlert.Read.All` nem `SecurityIncident.Read.All`.

### Solução

Mover a verificação de `isMissingRoles` para **antes** de toda a lógica de tolerância. Se a mensagem contém "missing application roles" ou "missing role", é **sempre** um problema de permissão, nunca de licenciamento. Nenhuma das três condições deve marcá-lo como granted.

### Alteração em `validate-m365-connection/index.ts`

Na lógica de 403 (linhas ~794-814), reestruturar:

```typescript
} else if (response.status === 403) {
  // FIRST: Check if this is clearly a missing permission (not a license issue)
  const isMissingRoles = lowerMsg.includes('missing application roles') || lowerMsg.includes('missing role');
  
  if (!isMissingRoles) {
    // Only apply tolerance if NOT a missing permission error
    const isKnownLicenseError = (
      lowerCode.includes('nonpremiumtenant') ||
      lowerMsg.includes('license') ||
      lowerMsg.includes('premium') ||
      lowerCode === 'forbidden' ||
      lowerCode === 'unknownerror'
    );
    const isSecurityLicenseIssue = isSecurityEndpoint && !lowerMsg.includes('insufficient privileges');
    const isAdminLicenseIssue = (isAdminSharepoint || isBetaEndpoint) && !lowerMsg.includes('insufficient privileges');

    if (isKnownLicenseError || isSecurityLicenseIssue || isAdminLicenseIssue) {
      granted = true;
      console.log(`Permission ${perm.name}: 403 license/service issue - treating as granted`);
    }
  } else {
    console.log(`Permission ${perm.name}: 403 missing application roles - NOT treating as granted`);
  }
}
```

### Arquivo a modificar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/validate-m365-connection/index.ts` | Reestruturar lógica de 403 para que `isMissingRoles` bloqueie TODA tolerância |

Após o deploy, o usuário deve **Revalidar Permissões** do tenant BRASILUX. Desta vez, `SecurityAlert.Read.All` e `SecurityIncident.Read.All` aparecerão como `pending`, e o popup de Admin Consent será disparado para consentir essas permissões.

