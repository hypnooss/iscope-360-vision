

# Plano: Vincular Agent a Tenant M365 Existente

## Contexto

Atualmente, a vinculação de Agent a um Tenant M365 só é possível durante a criação do tenant no wizard. Não há opção para gerenciar essa vinculação em tenants já cadastrados.

### Estrutura Existente
- **Tabela `m365_tenant_agents`**: Já existe e relaciona tenants com agents (N:N)
- **TenantConnectionWizard**: Já possui lógica para vincular agent durante criação
- **TenantEditDialog**: Componente de edição simples (nome e domínio apenas)
- **TenantStatusCard**: Card que exibe informações do tenant

---

## Solução Proposta

Adicionar uma seção de **vinculação de Agent** no diálogo de edição do tenant (`TenantEditDialog`), exibindo apenas agents do mesmo workspace.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/m365/TenantEditDialog.tsx` | Adicionar seção de seleção/remoção de agent |
| `src/hooks/useTenantConnection.ts` | Adicionar funções para buscar e gerenciar agents vinculados |

---

## Mudanças Detalhadas

### 1. Hook `useTenantConnection.ts`

**Adicionar novas funções:**

```typescript
// Buscar agent vinculado ao tenant
const fetchLinkedAgent = async (tenantRecordId: string): Promise<{
  id: string;
  agent_id: string;
  agent_name: string;
  enabled: boolean;
} | null>

// Vincular agent ao tenant
const linkAgent = async (tenantRecordId: string, agentId: string): Promise<{ success: boolean; error?: string }>

// Desvincular agent do tenant
const unlinkAgent = async (tenantRecordId: string): Promise<{ success: boolean; error?: string }>
```

---

### 2. Componente `TenantEditDialog.tsx`

**Adicionar:**

1. **Estado para agents disponíveis e agent vinculado**
   - Lista de agents do mesmo workspace (client_id)
   - Agent atualmente vinculado (se houver)

2. **Buscar agents do workspace ao abrir**
   ```typescript
   useEffect(() => {
     if (tenant && open) {
       // Buscar agents do mesmo workspace
       const fetchAgents = async () => {
         const { data } = await supabase
           .from('agents')
           .select('id, name, certificate_thumbprint, azure_certificate_key_id')
           .eq('client_id', tenant.client.id)
           .eq('revoked', false)
           .order('name');
         setAvailableAgents(data || []);
       };

       // Buscar agent vinculado
       const fetchLinked = async () => {
         const { data } = await supabase
           .from('m365_tenant_agents')
           .select('id, agent_id, enabled, agents(name, certificate_thumbprint)')
           .eq('tenant_record_id', tenant.id)
           .maybeSingle();
         setLinkedAgent(data);
       };
     }
   }, [tenant, open]);
   ```

3. **UI para selecionar/remover agent**
   - Select com agents disponíveis (filtrados por client_id)
   - Exibir thumbprint e status do certificado Azure
   - Botão para vincular/desvincular

4. **Lógica de salvar**
   - Atualizar vinculação quando salvar

---

## UI Proposta no TenantEditDialog

```text
┌─────────────────────────────────────────────┐
│  Editar Tenant                              │
├─────────────────────────────────────────────┤
│                                             │
│  Tenant ID                                  │
│  ┌───────────────────────────────────────┐  │
│  │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  │  │
│  └───────────────────────────────────────┘  │
│  ⓘ O Tenant ID não pode ser alterado.      │
│                                             │
│  Nome de Exibição                           │
│  ┌───────────────────────────────────────┐  │
│  │ Contoso Corporation                   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Domínio do Tenant                          │
│  ┌───────────────────────────────────────┐  │
│  │ contoso.onmicrosoft.com               │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  🖥️ Agent para Análise PowerShell          │
│                                             │
│  Agent Vinculado                            │
│  ┌───────────────────────────────────────┐  │
│  │ PRECISIO-AZ              ▼            │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ⓘ Certificado registrado no Azure:        │
│     agent-bf518fcd-27FA1C0F                 │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Cliente Associado                          │
│  ┌───────────────────────────────────────┐  │
│  │ PRECISIO                              │  │
│  └───────────────────────────────────────┘  │
│                                             │
├─────────────────────────────────────────────┤
│                    [Cancelar]  [Salvar]     │
└─────────────────────────────────────────────┘
```

---

## Regras de Negócio

1. **Filtro de Agents**
   - Apenas agents com `client_id` igual ao `client.id` do tenant
   - Apenas agents não revogados (`revoked = false`)

2. **Indicadores Visuais**
   - Agents com `azure_certificate_key_id` preenchido mostram badge "Certificado OK"
   - Agents sem certificado Azure mostram badge "Certificado Pendente"

3. **Vinculação**
   - Um tenant pode ter apenas um agent vinculado por vez
   - Ao selecionar um novo agent, substitui o anterior
   - Opção "Nenhum" remove a vinculação

---

## Fluxo de Dados

```text
┌──────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  TenantEditDialog│ ──► │ m365_tenant_agents  │ ◄── │     agents      │
│                  │     │                     │     │                 │
│  - Seleciona     │     │  - tenant_record_id │     │  - client_id    │
│    agent         │     │  - agent_id         │     │  - certificate  │
│                  │     │  - enabled          │     │  - azure_key_id │
└──────────────────┘     └─────────────────────┘     └─────────────────┘
         │                        │
         │                        │
         ▼                        ▼
   Filtro: agents onde       Relacionamento
   client_id = tenant.client.id
```

---

## Resultado Esperado

Após a implementação:

1. Ao clicar em "Editar" no card do tenant, o diálogo mostrará a seção de vinculação de agent
2. O dropdown listará apenas agents do mesmo workspace
3. Agents com certificado Azure registrado terão indicação visual
4. Ao salvar, a vinculação será criada/atualizada na tabela `m365_tenant_agents`
5. A vinculação permitirá que análises PowerShell usem o certificado do agent

