

## Adicionar abas à janela lateral de Cobertura MFA

### Contexto
Sim, é totalmente possível criar abas inline na sheet. O componente `Tabs` do Radix já está importado no arquivo. A API da Graph já retorna os dados por usuário (`userPrincipalName`, `userDisplayName`, `methodsRegistered`) — só que hoje a edge function descarta esses detalhes e salva apenas contagens agregadas.

### Plano

#### 1. Edge Function — salvar lista de usuários MFA (`entra-id-dashboard/index.ts`)
Além dos dados agregados já salvos, incluir um novo campo `mfa.userDetails` com a lista completa de usuários member e seus métodos:

```ts
mfa: {
  total, enabled, disabled, methodBreakdown,
  userDetails: mfaUsers.map(u => ({
    displayName: u.userDisplayName,
    upn: u.userPrincipalName,
    methods: u.methodsRegistered || [],
    hasMfa: /* mesmo critério já usado para mfaEnabled */
  }))
}
```

#### 2. Tipos — atualizar interface (`useEntraIdDashboard.ts`)
Adicionar ao tipo `mfa`:
```ts
mfa: {
  ...existing,
  userDetails?: Array<{
    displayName: string;
    upn: string;
    methods: string[];
    hasMfa: boolean;
  }>;
}
```

#### 3. UI — abas na sheet (`EntraIdCategorySheet.tsx`)
Na seção `mfa_coverage`, envolver o conteúdo em `<Tabs defaultValue="overview">`:

- **Aba "Status Geral"**: conteúdo atual (Resumo MFA + Distribuição por Método)
- **Aba "MFA Habilitado"**: lista dos usuários onde `hasMfa === true`, mostrando nome, UPN e badges dos métodos. Limite de 10 itens visíveis + campo de busca que filtra na lista completa.
- **Aba "MFA Desativado"**: lista dos usuários onde `hasMfa === false`, mostrando nome e UPN. Mesmo limite de 10 + busca.

Cada item da lista será um card compacto com:
- Nome do usuário (bold)
- UPN (text-muted, text-xs)
- Badges dos métodos registrados (apenas na aba "MFA Habilitado")

#### 4. Redeploy da Edge Function
Necessário redeployar e executar nova análise para gerar snapshot com `userDetails`.

### Arquivos alterados
| Arquivo | Alteração |
|---|---|
| `supabase/functions/entra-id-dashboard/index.ts` | Incluir `userDetails` no objeto `mfa` do resultado |
| `src/hooks/useEntraIdDashboard.ts` | Adicionar `userDetails` ao tipo e ao mapper |
| `src/components/m365/entra-id/EntraIdCategorySheet.tsx` | Adicionar Tabs com 3 abas, lista com busca e limite de 10 |

