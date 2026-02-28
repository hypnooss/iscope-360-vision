

## Plan: Ajustar página de adição M365

### 1. Aumentar largura do container (`src/pages/environment/AddM365TenantPage.tsx`)
- **Linha 636**: Alterar `max-w-2xl` para `max-w-4xl` no div principal do wizard.

### 2. Atualizar lista de permissões para incluir todas
Substituir o array de permissões no `renderStep1` (linhas 432-449) por uma lista categorizada igual à tela de edição:

**Permissões do Microsoft Graph:**
- **Entra ID**: `User.Read.All`, `Directory.Read.All`, `Group.Read.All`, `Application.Read.All`, `AuditLog.Read.All`, `Organization.Read.All`, `Policy.Read.All`
- **Exchange Online**: `MailboxSettings.Read`, `Mail.Read`, `RoleManagement.ReadWrite.Directory`
- **SharePoint**: `Sites.Read.All`
- **Certificados**: `Application.ReadWrite.All`
- **Outros**: `Reports.Read.All` (opcional - requer Azure AD Premium)

**Roles do Diretório (RBAC):**
- Exchange Administrator
- SharePoint Administrator

Apresentar em seções agrupadas por categoria com layout em grid, similar ao print 2.

### 3. Mover botão Cancelar para o lado direito, junto ao Próximo
- **Linhas 655-704**: Reorganizar o footer do step 1 para que ambos os botões (Cancelar e Próximo) fiquem no lado direito (`justify-end`), com Cancelar à esquerda do Próximo.

