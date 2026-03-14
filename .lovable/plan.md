

## Corrigir exibição de cards OK em Entra ID e Colaboração + remover descrição dos cards pass

### Diagnóstico

**Entra ID Analyzer** — O `m365-analyzer` gera insights `fail` para categorias Entra (`identity_access`, `conditional_access`, `security_risk`, `account_compromise`) mas **não gera insights `pass`** quando não há problemas. Os pass insights existem apenas na função `entra-id-security-insights` que nunca é chamada pelo frontend.

**Colaboração Analyzer** — O `collaboration-dashboard` gera insights corretamente (incluindo `pass`) e os retorna no campo `insights`. O `useCollaborationDashboard` já expõe esse campo e o `TeamsAnalyzerPage` já faz o merge. O problema é que os dados no banco foram gerados **antes** das alterações no backend — ao atualizar o dashboard, os insights devem aparecer. Porém, para garantir, verificarei se o snapshot antigo no banco (sem campo `insights`) causa problemas no parse.

**Descrição nos cards pass** — Linhas 200-205 do `SecurityInsightCard.tsx` renderizam a descrição. Remover.

### Alterações

| Arquivo | O quê |
|---|---|
| `supabase/functions/m365-analyzer/index.ts` | Adicionar insights `pass` para categorias Entra ID quando nenhum problema detectado: `identity_access` (ex: "Nenhum Novo Usuário Suspeito"), `conditional_access` (ex: "Políticas de CA Ativas"), `security_risk` (ex: "Nenhum Sign-in de Alto Risco"), `account_compromise` (ex: "Nenhuma Conta Comprometida") |
| `src/components/m365/shared/SecurityInsightCard.tsx` | Remover bloco de descrição dos cards pass (linhas 200-205) |
| `src/hooks/useCollaborationDashboard.ts` | Verificar que o parse do snapshot lida com `insights` ausente (já tem `insights?: ...` — OK) |

### Detalhes técnicos

No `m365-analyzer`, após cada bloco condicional que gera insights de categorias Entra, adicionar `else` com insight pass. Exemplo:

```typescript
// Após o bloco de identity_access que verifica noMfa, newUsers, etc:
if (!hasIdentityIssues) {
  insights.push({
    id: 'identity_access_ok',
    category: 'identity_access',
    name: 'Identidades em Conformidade',
    description: 'Nenhuma anomalia de identidade detectada.',
    severity: 'info',
    status: 'pass',
  });
}
```

Repetir para `conditional_access`, `security_risk`, `account_compromise` e `operational_risks`.

O deploy das edge functions será necessário após as alterações.

