

## Plano: Tela de Configurações do Usuário (Minha Conta)

### Contexto
Atualmente, o menu "Minha Conta" no dropdown do sidebar tem dois itens: "Configurações" (sem ação) e "Trocar Senha" (abre dialog). Precisamos criar uma página dedicada `/account` onde o usuário gerencia suas informações pessoais e MFA.

### O que será criado

**Nova página: `src/pages/AccountPage.tsx`**

Página com 3 seções em tabs:

1. **Perfil** — Editar nome completo e visualizar email (readonly)
   - Campo `full_name` editável com save via `supabase.from('profiles').update()`
   - Email exibido como readonly (não editável pelo usuário)

2. **Segurança / Senha** — Trocar senha inline (reutilizando a lógica do `ChangePasswordDialog`)
   - Campos nova senha + confirmação com validação forte (12+ chars)
   - Indicadores visuais dos requisitos de senha (checklist)

3. **MFA (Autenticação em dois fatores)** — Gerenciar fatores TOTP
   - Mostrar status atual (ativo/inativo)
   - Se ativo: mostrar nome do fator, data de criação, botão para resetar (unenroll + re-enroll)
   - Se inativo: botão para configurar (redireciona para `/mfa/enroll`)

### Alterações em arquivos existentes

- **`src/App.tsx`**: Adicionar rota `/account` → `AccountPage`
- **`src/components/layout/AppLayout.tsx`**: 
  - Item "Configurações" no dropdown → `navigate('/account')`
  - Manter "Trocar Senha" apontando para a mesma página com tab ativa de segurança
- **`src/components/ChangePasswordDialog.tsx`**: Sem alteração (mantido para uso em outros contextos)

### Detalhes técnicos

- Layout usando `AppLayout` com `PageBreadcrumb`
- Tabs via Radix `Tabs` component existente
- MFA status via `supabase.auth.mfa.listFactors()` 
- Reset MFA: `unenroll` fator verificado → redireciona para `/mfa/enroll`
- Profile update: `supabase.from('profiles').update({ full_name }).eq('id', user.id)`
- Validação de senha usando `passwordRequirements` de `src/lib/passwordValidation.ts` com checklist visual

