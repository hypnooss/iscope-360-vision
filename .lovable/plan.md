

## Plan: Exibir info do Agent e remover botão Editar na tela de edição do Tenant M365

### Arquivo: `src/pages/environment/M365TenantEditPage.tsx`

**1. Adicionar query para buscar agent vinculado**
- Query na tabela `m365_tenant_agents` com join em `agents(id, name, certificate_thumbprint, azure_certificate_key_id)` filtrado por `tenant_record_id = id`.

**2. Adicionar seção "Agent para Análise PowerShell" no card**
- Entre a seção de Workspace/Status e Permissões, inserir nova seção com:
  - Título: "Agent para Análise PowerShell" (com ícone `Monitor`)
  - Subtítulo "Agent Vinculado"
  - Nome do agent + Badge "Cert OK" (verde) ou "Pendente" (amarelo)
  - Se tiver certificado: mostrar "Certificado registrado no Azure" + key_id em fonte mono
  - Se não tiver agent vinculado: texto "Nenhum agent vinculado"

**3. Remover botão "Editar" dos action buttons**
- Remover o `<Button>` com ícone `Pencil` e texto "Editar" (linha 306-308)
- Remover o state `showEditDialog` e o componente `TenantEditDialog` (já não será mais necessário)
- Remover imports não utilizados (`Pencil`, `TenantEditDialog`)

