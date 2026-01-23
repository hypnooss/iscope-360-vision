
# Plano: Reestruturar Sistema de Permissões e Criar Gestão de Módulos

## Resumo da Mudança

Vamos simplificar o sistema de permissões, unificando "Módulos com Acesso" e "Permissões por Área" em uma única estrutura. Cada usuário terá permissões específicas por módulo: **Sem Acesso**, **Visualizar** ou **Editar**.

---

## O Que Será Feito

### 1. Criar Página de Gestão de Módulos
Nova aba "Módulos" em **Administração > Configurações** onde você poderá:
- Visualizar todos os módulos cadastrados
- Adicionar novos módulos (código, nome, descrição, ícone)
- Editar módulos existentes
- Ativar/desativar módulos

### 2. Alterar Interface de Usuários
No formulário de criação/edição de usuários:
- Remover seção "Permissões por Área"
- Ajustar "Módulos com Acesso" para mostrar cada módulo com um seletor de permissão:
  - **Sem Acesso** (não aparece no menu)
  - **Visualizar** (pode ver, não pode editar)
  - **Editar** (acesso completo)

### 3. Popular Módulos no Banco de Dados
Inserir os 4 módulos iniciais:

| Código | Nome | Ícone |
|--------|------|-------|
| scope_firewall | Firewall | Shield |
| scope_m365 | Microsoft 365 | Cloud |
| scope_network | Network | Network |
| scope_cloud | Cloud | Server |

---

## Detalhes Técnicos

### Alterações no Banco de Dados

**Migration 1: Popular tabela `modules`**
```sql
INSERT INTO modules (code, name, description, icon, is_active) VALUES
  ('scope_firewall', 'Firewall', 'Análise e gestão de firewalls', 'Shield', true),
  ('scope_m365', 'Microsoft 365', 'Gestão de tenants Microsoft 365', 'Cloud', true),
  ('scope_network', 'Network', 'Monitoramento de rede', 'Network', true),
  ('scope_cloud', 'Cloud', 'Gestão de infraestrutura cloud', 'Server', true)
ON CONFLICT (code) DO NOTHING;
```

**Migration 2: Adicionar coluna `permission` na tabela `user_modules`**
```sql
ALTER TABLE user_modules 
ADD COLUMN permission TEXT NOT NULL DEFAULT 'view' 
CHECK (permission IN ('view', 'edit'));
```

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/admin/SettingsPage.tsx` | Adicionar aba "Módulos" com CRUD completo |
| `src/components/InviteUserDialog.tsx` | Remover "Permissões por Área", ajustar seletor de módulos |
| `src/pages/UsersPage.tsx` | Mesmas alterações do InviteUserDialog no dialog de edição |
| `supabase/functions/create-user/index.ts` | Ajustar para salvar permission junto com module_id |
| `src/contexts/ModuleContext.tsx` | Ajustar para buscar permission de user_modules |

### Novo Componente: Gestão de Módulos

```text
┌─────────────────────────────────────────────────────────┐
│ Configurações                                           │
├─────────────────────────────────────────────────────────┤
│ [Microsoft 365] [Módulos]                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Módulos do Sistema                    [+ Novo Módulo]   │
│ Gerencie os módulos disponíveis na plataforma           │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Código         │ Nome           │ Status  │ Ações   │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ scope_firewall │ Firewall       │ ✓ Ativo │ ✏️ 🗑️  │ │
│ │ scope_m365     │ Microsoft 365  │ ✓ Ativo │ ✏️ 🗑️  │ │
│ │ scope_network  │ Network        │ ✓ Ativo │ ✏️ 🗑️  │ │
│ │ scope_cloud    │ Cloud          │ ✓ Ativo │ ✏️ 🗑️  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Nova Interface de Permissões por Módulo

No formulário de usuário, substituir checkboxes por seletores:

```text
┌─────────────────────────────────────────────────────────┐
│ Módulos com Acesso                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Firewall        [▼ Visualizar    ]                      │
│ Microsoft 365   [▼ Sem Acesso    ]                      │
│ Network         [▼ Editar        ]                      │
│ Cloud           [▼ Sem Acesso    ]                      │
│                                                         │
└─────────────────────────────────────────────────────────┘

Opções do seletor:
- Sem Acesso (não mostra o módulo)
- Visualizar (pode ver, não edita)
- Editar (acesso completo)
```

### Lógica de Acesso

- **Sem Acesso**: Usuário não vê o módulo no menu lateral
- **Visualizar**: Usuário vê o módulo, pode navegar, mas botões de ação ficam desabilitados
- **Editar**: Acesso completo ao módulo

---

## Ordem de Implementação

1. Criar migration para popular módulos
2. Criar migration para adicionar coluna `permission` em `user_modules`
3. Atualizar `SettingsPage.tsx` com aba de Módulos
4. Atualizar `InviteUserDialog.tsx` com nova interface
5. Atualizar `UsersPage.tsx` (dialog de edição)
6. Atualizar `create-user` edge function
7. Atualizar `ModuleContext.tsx` para usar nova estrutura

---

## Resultado Final

- Interface unificada e simplificada para gestão de permissões
- Administradores podem criar novos módulos diretamente pela interface
- Novos módulos aparecem automaticamente nas opções de permissão dos usuários
