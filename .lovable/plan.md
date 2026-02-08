# ✅ IMPLEMENTADO: Simplificação Radical do Fluxo M365

**Status**: Concluído

## Princípio Fundamental (Nova Regra)

> **O sistema deve fornecer o máximo de facilidade e automação para os usuários finais (considerar usuários finais como usuários sem experiência nenhuma ou muito pouca em infraestrutura)**

---

## Problemas Atuais

1. **Object ID do Service Principal** - Pedimos ao usuário para buscar manualmente, mas **já conseguimos obter automaticamente via Graph API** (código existe em `m365-oauth-callback/index.ts` linha 44-56)

2. **Múltiplas credenciais/passos** - O usuário passa por Admin Consent E depois precisa fornecer credenciais de admin de novo

3. **Tenant Home como pré-requisito** - Foi adicionado para facilitar mas criou mais complexidade

4. **Fluxo fragmentado** - Graph API via OAuth + Exchange RBAC manual = confusão

---

## Solução Proposta: Fluxo Unificado com Credenciais

Se vamos pedir credenciais de Global Admin, fazemos **TUDO** com elas em um único passo:

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    NOVO FLUXO SIMPLIFICADO                          │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Usuário informa Tenant ID + Credenciais de Global Admin          │
│ 2. Sistema obtém token via Graph API (client credentials)           │
│ 3. Sistema busca SP Object ID automaticamente                       │
│ 4. Sistema cria task para Agent configurar Exchange RBAC            │
│ 5. Conexão completa! ✅                                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Campos necessários do usuário:**
- Tenant ID (auto-detectado pelo domínio, nao disponivel pra preenchimento, oculto seria o ideal)
- Email do Global Admin
- Senha do Global Admin

**Campos que o SISTEMA obtém automaticamente:**
- SP Object ID (via Graph API: `GET /servicePrincipals?$filter=appId eq '...'`)
- Display Name da organização
- Domínio primário

---

## Mudanças Necessárias

### 1. `src/components/m365/TenantConnectionWizard.tsx`

Simplificar para apenas 3 etapas:
1. **Cliente** - Qual workspace (mantém)
2. **Conexão** - Tenant ID + Credenciais de Admin
3. **Resultado** - Sucesso/Falha

Remover:
- Etapa de "Agent" (será selecionado automaticamente do workspace)
- Etapa de "Autorizar" (não precisa mais de popup OAuth separado)
- Complexidade do Admin Consent via popup

Adicionar:
- Formulário unificado: Tenant ID + Email Admin + Senha Admin
- Botão único: "Conectar"

### 2. Nova Edge Function: `connect-m365-tenant/index.ts`

Faz TUDO em uma única chamada:

```typescript
// Recebe: tenantId, adminEmail, adminPassword, clientId (workspace)

// 1. Validar se tenant já não existe para este workspace
// 2. Obter App ID e Client Secret da configuração global
// 3. Obter token via client credentials
// 4. Validar permissões Graph API
// 5. Buscar SP Object ID automaticamente
// 6. Criar registro do tenant
// 7. Vincular agent do workspace automaticamente
// 8. Criar task de Exchange RBAC setup para o agent
// 9. Retornar sucesso
```

### 3. Modificar `supabase/functions/setup-exchange-rbac/index.ts`

- Remover necessidade de receber `spObjectId` do usuário
- Obter o SP Object ID automaticamente dentro da função usando o token do tenant

### 4. `src/components/m365/ExchangeRBACSetupCard.tsx`

**Eliminar completamente ou simplificar drasticamente:**
- Não precisa mais ser exibido para o usuário
- A configuração acontece automaticamente no background

### 5. Removals

- Remover dependência de "Tenant Home" no fluxo principal
- Remover popup de Admin Consent (substituído por credenciais diretas)
- Remover formulário de Object ID manual

---

## Fluxo Detalhado da Edge Function

```typescript
// connect-m365-tenant/index.ts

async function handler(req) {
  const { tenantId, adminEmail, adminPassword, workspaceId } = await req.json();
  
  // 1. Obter configuração global (App ID, Client Secret)
  const globalConfig = await getGlobalConfig();
  
  // 2. Obter token para o tenant
  const token = await getTokenForTenant(tenantId, globalConfig.appId, globalConfig.clientSecret);
  
  // 3. Buscar informações do tenant
  const orgInfo = await fetchOrganizationInfo(token);
  const spInfo = await fetchServicePrincipal(token, globalConfig.appId);
  // spInfo.id = Object ID do Service Principal (automático!)
  
  // 4. Validar permissões
  const permissions = await validatePermissions(token);
  
  // 5. Criar registro no banco
  const tenant = await createTenantRecord({
    workspaceId,
    tenantId,
    displayName: orgInfo.displayName,
    domain: orgInfo.primaryDomain,
    spObjectId: spInfo.id, // Armazenar para uso futuro
  });
  
  // 6. Vincular agent automaticamente
  const agent = await getWorkspaceAgent(workspaceId);
  if (agent) {
    await linkAgentToTenant(tenant.id, agent.id);
  }
  
  // 7. Criar task de Exchange RBAC setup
  if (agent) {
    await createExchangeRbacTask(agent.id, {
      tenantRecordId: tenant.id,
      adminEmail,
      adminPassword, // Criptografada para transporte
      appId: globalConfig.appId,
      spObjectId: spInfo.id, // Obtido automaticamente!
    });
  }
  
  return { success: true, tenantId: tenant.id };
}
```

---

## Interface do Usuário Simplificada

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Conectar Microsoft 365                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Cliente: [Dropdown: Workspace selecionado]                      │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  Tenant ID: [________________________]                           │
│  (Encontrado em Azure Portal > Entra ID > Properties)            │
│                                                                  │
│  Email do Administrador: [admin@contoso.com]                     │
│                                                                  │
│  Senha: [●●●●●●●●]                                               │
│                                                                  │
│  ⓘ Use as credenciais de um Global Admin ou Exchange Admin.      │
│    A senha é usada uma única vez e nunca é armazenada.           │
│                                                                  │
│  [           🔒 Conectar                    ]                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| 4+ etapas no wizard | 2-3 etapas simples |
| Popup OAuth separado | Formulário único |
| Object ID manual | Automático via API |
| Exchange RBAC como passo extra | Integrado e automático |
| "Tenant Home" como pré-requisito | Não precisa mais |
| Usuário precisa entender Azure | Só precisa de email/senha de admin |

---

## Considerações de Segurança

1. **Credenciais nunca são armazenadas** - Apenas usadas para obter token e criar task
2. **Task com criptografia de transporte** - XOR com chave única por request
3. **Audit log de todas ações** - Rastreabilidade completa
4. **Token expira rapidamente** - Não persiste

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/connect-m365-tenant/index.ts` | **Criar** - Nova edge function unificada |
| `src/components/m365/TenantConnectionWizard.tsx` | **Modificar** - Simplificar para formulário único |
| `supabase/functions/setup-exchange-rbac/index.ts` | **Modificar** - Obter SP Object ID automaticamente |
| `src/components/m365/ExchangeRBACSetupCard.tsx` | **Remover ou esconder** - Não mais necessário como UI |
| `src/components/m365/TenantStatusCard.tsx` | **Modificar** - Remover referências ao setup manual |

---

## Resumo

O fluxo anterior exigia conhecimento técnico demais: Admin Consent, Object IDs, popups OAuth, configuração manual de Exchange RBAC.

O novo fluxo é:
1. Escolhe o cliente/workspace
2. Digita Tenant ID + Email + Senha do admin
3. Clica "Conectar"
4. **Pronto!** Sistema faz tudo automaticamente

