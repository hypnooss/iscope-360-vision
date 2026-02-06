
# Plano: Expandir Verificações, Filtro por Workspace, Seletor de Tenant e Preview Mode

## Visão Geral

Este plano cobre 4 melhorias no módulo M365 Postura de Segurança:

1. **Expandir verificações** na Edge Function (mais insights de segurança)
2. **Filtro por Workspace** para respeitar dados do usuário (Preview Mode incluso)
3. **Seletor de Tenant** para alternar entre múltiplos tenants conectados
4. **Preview Mode** aplicado corretamente na página

---

## 1. Expandir Verificações na Edge Function

### Verificações a Implementar

| Código | Categoria | Descrição | Endpoint Graph API |
|--------|-----------|-----------|-------------------|
| **ADM-001** | admin_privileges | Excesso de Global Admins (>5) | `/directoryRoles/.../members` |
| **ADM-002** | admin_privileges | Admins sem MFA | Combina roles + MFA status |
| **AUT-001** | auth_access | Security Defaults desabilitados | `/policies/identitySecurityDefaultsEnforcementPolicy` |
| **APP-001** | apps_integrations | Credenciais de apps expirando em 30 dias | `/applications` + passwordCredentials |
| **APP-002** | apps_integrations | Credenciais de apps expiradas | `/applications` + passwordCredentials |
| **EXO-001** | email_exchange | Regras de redirecionamento externo | `/users/{id}/mailFolders/inbox/messageRules` |

### Arquitetura Modular

A Edge Function será reestruturada com coletores paralelos:

```text
m365-security-posture
├── Autenticação (decrypt + token)
├── Promise.allSettled([
│   ├── collectIdentityInsights()      → IDT-001 (MFA)
│   ├── collectAdminInsights()         → ADM-001, ADM-002
│   ├── collectAuthInsights()          → AUT-001
│   ├── collectAppsInsights()          → APP-001, APP-002
│   └── collectExchangeInsights()      → EXO-001
│   ])
└── Consolidação + Score
```

Cada coletor:
- Retorna `{ insights: M365Insight[], errors?: string[] }`
- Falha parcial não quebra toda a análise
- Logs detalhados para debugging

---

## 2. Filtro por Workspace (+ Preview Mode)

### Problema Atual
A página `M365PosturePage.tsx` busca qualquer tenant `connected` sem filtrar por workspace do usuário.

### Solução
Aplicar o padrão já usado em `FirewallListPage` e `ExternalDomainListPage`:

```typescript
// Em M365PosturePage.tsx
const { isPreviewMode, previewTarget } = usePreview();

// Ao buscar tenants:
const workspaceIds = isPreviewMode && previewTarget?.workspaces
  ? previewTarget.workspaces.map(w => w.id)
  : null;

let tenantsQuery = supabase
  .from('m365_tenants')
  .select('id, display_name, tenant_domain, client_id')
  .eq('connection_status', 'connected');

if (workspaceIds && workspaceIds.length > 0) {
  tenantsQuery = tenantsQuery.in('client_id', workspaceIds);
}
```

### Arquivos Afetados
- `src/pages/m365/M365PosturePage.tsx`
- `src/hooks/useM365SecurityPosture.ts` (adicionar dependência de workspaces)

---

## 3. Seletor de Tenant

### Componente: `TenantSelector`

Um dropdown no header da página para alternar entre tenants conectados:

```text
┌────────────────────────────────────────────┐
│  ▼ Tenant: Contoso Corp (contoso.com)      │
├────────────────────────────────────────────┤
│    ✓ Contoso Corp (contoso.com)            │
│      Fabrikam Inc (fabrikam.com)           │
│      Acme Corp (acme.onmicrosoft.com)      │
└────────────────────────────────────────────┘
```

### Comportamento
1. Carregar todos os tenants conectados do(s) workspace(s) do usuário
2. Exibir tenant selecionado no header (ao lado do Score Gauge)
3. Ao trocar, atualizar `tenantRecordId` e refazer análise
4. URL param `?tenant=uuid` para deep-link

### Localização na UI
- Dentro do card de Score, ao lado das informações do tenant
- Ou como dropdown no header antes do botão "Atualizar"

---

## 4. Preview Mode

### Checklist de Implementação

| Item | Status | Descrição |
|------|--------|-----------|
| Filtro de dados | A fazer | Tenants filtrados por workspaces do target |
| Hook usePreviewGuard | Existente | Bloquear ações de mutação |
| Banner visual | Existente (AppLayout) | Banner âmbar já aparece |
| Botões de ação | A verificar | Desabilitar "Atualizar" se mutação |

### Ações Permitidas no Preview
- Visualizar análise
- Navegar entre categorias
- Ver detalhes de insights

### Ações Bloqueadas (se houver futuras mutações)
- Criar agendamentos de análise
- Exportar relatórios (se envolver escrita)

---

## Detalhes Técnicos

### Mudanças na Edge Function

```typescript
// Estrutura modular
interface CollectorResult {
  insights: M365Insight[];
  errors?: string[];
}

async function collectAdminInsights(accessToken: string): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const errors: string[] = [];
  
  // ADM-001: Excesso de Global Admins
  const roleRes = await fetch(
    'https://graph.microsoft.com/v1.0/directoryRoles?$filter=displayName eq \'Global Administrator\'',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  // ... lógica de verificação
  
  return { insights, errors };
}
```

### Novo Componente TenantSelector

```typescript
interface TenantSelectorProps {
  tenants: Array<{ id: string; displayName: string; domain: string }>;
  selectedId: string;
  onSelect: (tenantId: string) => void;
  loading?: boolean;
  disabled?: boolean; // Para preview mode
}
```

### Atualização do Hook useM365SecurityPosture

Adicionar parâmetro opcional para workspaces:
```typescript
interface UseM365SecurityPostureOptions {
  tenantRecordId: string;
  workspaceIds?: string[]; // Para filtro interno se necessário
  dateFrom?: string;
  dateTo?: string;
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/m365-security-posture/index.ts` | Modificar | Expandir com coletores modulares |
| `src/pages/m365/M365PosturePage.tsx` | Modificar | Adicionar filtro workspace + seletor tenant |
| `src/components/m365/posture/TenantSelector.tsx` | Criar | Dropdown de seleção de tenant |
| `src/components/m365/posture/index.ts` | Modificar | Exportar TenantSelector |
| `src/hooks/useM365SecurityPosture.ts` | Modificar | Pequenos ajustes se necessário |

---

## Ordem de Implementação

1. **Edge Function** - Expandir verificações (base de dados)
2. **Filtro Workspace** - Garantir isolamento de dados
3. **Seletor de Tenant** - UX para múltiplos tenants
4. **Preview Mode** - Verificar e ajustar bloqueios

---

## Resultado Esperado

- 6+ verificações de segurança ativas (vs 1 atual)
- Dados filtrados corretamente por workspace do usuário
- Usuários com múltiplos tenants podem alternar facilmente
- Preview Mode funciona sem expor dados de outros workspaces
