
## Renomear "Cliente" para "Workspace" e Habilitar Edição para Super Admin

### Objetivo
Padronizar a terminologia de "Cliente" para "Workspace" nas telas de Domínio Externo e Firewall, além de permitir que Super Admins alterem o workspace na edição de domínio externo.

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/external-domain/ExternalDomainTable.tsx` | Trocar header "Cliente" por "Workspace" |
| `src/components/external-domain/EditExternalDomainDialog.tsx` | Trocar label "Cliente" por "Workspace", adicionar Select editável para Super Admin |
| `src/pages/external-domain/ExternalDomainListPage.tsx` | Passar lista de clients e isSuperAdmin para o EditDialog |
| `src/pages/firewall/FirewallListPage.tsx` | Trocar header "Cliente" por "Workspace" na tabela |
| `src/components/firewall/EditFirewallDialog.tsx` | Trocar label "Cliente *" por "Workspace *" |
| `src/pages/firewall/FirewallReportsPage.tsx` | Trocar header "Cliente" por "Workspace" na tabela |

---

### Detalhamento das Mudanças

#### 1. ExternalDomainTable.tsx
- Linha 81: `<TableHead>Cliente</TableHead>` → `<TableHead>Workspace</TableHead>`

#### 2. EditExternalDomainDialog.tsx
- Linha 101: `<Label>Cliente</Label>` → `<Label>Workspace</Label>`
- Adicionar props `clients` e `isSuperAdmin`
- Se `isSuperAdmin === true`: exibir Select editável com lista de workspaces
- Se `isSuperAdmin === false`: manter Input disabled (comportamento atual)
- Atualizar `onSave` para incluir `client_id` quando alterado
- Atualizar lógica de fetch de agents quando client_id mudar

#### 3. ExternalDomainListPage.tsx
- Passar `clients={clients}` e `isSuperAdmin={isSuperAdmin()}` para EditExternalDomainDialog
- Atualizar `handleEditDomain` para aceitar `client_id` no payload

#### 4. FirewallListPage.tsx
- Linha 490: `<TableHead>Cliente</TableHead>` → `<TableHead>Workspace</TableHead>`

#### 5. EditFirewallDialog.tsx
- Linha 223: `<Label htmlFor="edit-fw-client">Cliente *</Label>` → `<Label htmlFor="edit-fw-client">Workspace *</Label>`
- Linha 229: placeholder "Selecione um cliente" → "Selecione um workspace"

#### 6. FirewallReportsPage.tsx
- Linha 402: `<TableHead>Cliente</TableHead>` → `<TableHead>Workspace</TableHead>`

---

### Lógica para Edição de Workspace (Domínio Externo)

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    EDIÇÃO DE WORKSPACE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SE isSuperAdmin OU isSuperSuporte:                                 │
│     → Exibir Select com lista de workspaces disponíveis             │
│     → Ao mudar workspace, recarregar lista de agents do novo wks    │
│     → Limpar agent_id selecionado                                   │
│                                                                     │
│  SENÃO:                                                             │
│     → Exibir Input disabled com nome do workspace (atual)           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Seção Técnica

**Interface atualizada do EditExternalDomainDialog:**

```typescript
interface EditExternalDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: ExternalDomainRow | null;
  clients: Client[];  // NOVO
  isSuperAdmin: boolean;  // NOVO
  onSave: (payload: { 
    client_id?: string;  // NOVO (opcional)
    agent_id: string; 
    schedule: ScheduleFrequency 
  }) => Promise<void>;
}
```

**Atualização do handleEditDomain no ExternalDomainListPage:**

```typescript
const handleEditDomain = async (payload: { 
  client_id?: string; 
  agent_id: string; 
  schedule: ScheduleFrequency 
}) => {
  // Se client_id foi alterado, incluir no update
  const updateData: any = { agent_id: payload.agent_id };
  if (payload.client_id && payload.client_id !== editingDomain?.client_id) {
    updateData.client_id = payload.client_id;
  }
  // ... resto da lógica
};
```

---

### Estimativa

| Tarefa | Tempo |
|--------|-------|
| Renomear labels nas tabelas | 10min |
| Renomear label no EditFirewallDialog | 5min |
| Modificar EditExternalDomainDialog | 30min |
| Atualizar ExternalDomainListPage | 15min |
| Testes | 15min |
| **Total** | **~1h** |
