

## Plan: Reestruturar wizard de adição M365

### `src/pages/environment/AddM365TenantPage.tsx`

1. **Renomear passo 1 para "Instruções"** — Alterar `STEPS[0].label` de `'Workspace'` para `'Instruções'`.

2. **Novo conteúdo do passo 1 (Instruções)** — Substituir `renderStep1` por uma tela informativa contendo:
   - Nome do aplicativo que será criado: **iScope 360**
   - Explicação do que o processo faz (registra o app iScope 360 no tenant do cliente via Admin Consent)
   - Pré-requisitos: conta com permissão de Global Administrator
   - Lista das permissões Graph API que serão solicitadas (Application.ReadWrite.All, Directory.Read.All, User.Read.All, Mail.Read, etc.)
   - Nota sobre o consentimento ser feito numa janela popup da Microsoft

3. **Mover seleção de Workspace para o passo 2** — Inserir no `renderStep2` (antes do campo de email) a seleção de workspace, mas **apenas visível** quando `role === 'super_admin' || role === 'super_suporte'`. Para usuários não-super, o workspace será auto-selecionado silenciosamente (como já acontece quando `clients.length === 1`).

4. **Importar `role` do `useAuth`** — Adicionar `role` ao destructuring de `useAuth()` para verificar se é super role.

5. **Ajustar títulos do CardHeader** — Step 1: "Antes de começar", Step 2: manter "Autenticação" (ou "Conta do Administrador").

6. **Ajustar validação `canProceedStep1`** — Passo 1 agora é informativo, sempre pode prosseguir. A validação de workspace move para `canProceedStep2` (super roles precisam ter workspace selecionado + email válido).

7. **Ajustar navegação e botões** — Step 1: "Cancelar" à esquerda, "Próximo" à direita (sempre habilitado). Step 2: "Voltar" e "Conectar".

