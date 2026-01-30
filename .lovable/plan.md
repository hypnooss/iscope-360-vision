
## Objetivo
Na tela **Domínio Externo > Domínios Externos**:
1) Fazer o botão **Editar** funcionar (permitindo alterar somente **Agent** e **Frequência**).
2) Fazer o botão **Excluir** funcionar (excluindo também as **tarefas pendentes/rodando** desse domínio na fila do agent).

---

## Contexto (como está hoje)
- `ExternalDomainTable.tsx` já renderiza os ícones **Pencil** e **Trash2**, porém ambos estão `disabled`.
- `ExternalDomainListPage.tsx` já tem:
  - `fetchData()` (carrega domains, schedules, clients e agents)
  - `handleAnalyze()` (Analisar)
  - `handleAddDomain()` (Adicionar)
- Já existe padrão pronto no módulo Firewall (`src/pages/firewall/FirewallListPage.tsx`) para:
  - Abrir dialog de edição (`EditFirewallDialog`)
  - Confirmar exclusão via `AlertDialog`
  - Executar delete com toast e refresh

---

## Design proposto (alto nível)
### Editar
- Adicionar um **dialog de edição** para Domínio Externo (novo componente), com os campos:
  - **Domínio** (somente leitura)
  - **Cliente** (somente leitura)
  - **Agent** (editável)
  - **Frequência** (editável)
- Ao salvar:
  - Atualizar `external_domains.agent_id`
  - Atualizar frequência:
    - Remover schedules existentes de `external_domain_schedules` para aquele `domain_id`
    - Se frequência != `manual`, inserir um schedule ativo
  - Recarregar lista (`fetchData()`) e exibir toast de sucesso

### Excluir
- Ao confirmar exclusão:
  1) Apagar tarefas **pending/running** de `agent_tasks` relacionadas ao domínio:
     - `target_type = 'external_domain'`
     - `target_id = <domain.id>`
     - `status IN ('pending', 'running')`
  2) Apagar o registro em `external_domains` (as schedules serão removidas por cascade).
  3) Recarregar lista (`fetchData()`) e exibir toast de sucesso.

---

## Alterações planejadas por arquivo

### 1) `src/components/external-domain/ExternalDomainTable.tsx`
**Objetivo:** tornar os botões “Editar” e “Excluir” clicáveis.

- Alterar props do componente para receber callbacks:
  - `onEdit(domain: ExternalDomainRow): void`
  - `onDelete(domain: ExternalDomainRow): void`
- Remover `disabled` dos botões e ligar os handlers:
  - Pencil → `onEdit(domain)`
  - Trash → `onDelete(domain)`
- Manter regra de permissão: só exibe botões se `canEdit`.

### 2) `src/pages/external-domain/ExternalDomainListPage.tsx`
**Objetivo:** controlar estados de edição/exclusão e executar update/delete no Supabase.

Adicionar estados:
- `showEditDialog: boolean`
- `editingDomain: ExternalDomainRow | null`
- `deletingDomain: ExternalDomainRow | null`

Adicionar handlers:
- `openEditDialog(domain)` → seta `editingDomain` + abre dialog
- `handleEditDomain({ agent_id, schedule })`:
  - update `external_domains` (somente `agent_id`)
  - delete schedules anteriores de `external_domain_schedules` por `domain_id`
  - inserir schedule se != manual
  - `await fetchData()`, fechar dialog, toast success
- `handleDeleteDomain(domain)`:
  - delete `agent_tasks` onde:
    - `target_type = 'external_domain'`
    - `target_id = domain.id`
    - `status in ('pending','running')`
  - delete `external_domains` por `id`
  - `await fetchData()`, fechar AlertDialog, toast success

UI:
- Renderizar:
  - `EditExternalDomainDialog` (novo componente) com `open`, `onOpenChange`, `domain`, `clients` (para mostrar nome), e `onSave`
  - `AlertDialog` de confirmação (mesmo padrão de FirewallListPage), exibindo o domínio (ex.: `domain.domain`) na mensagem.

Obs.: a lista de `clients` já existe no page; para “Cliente (somente leitura)” podemos exibir `editingDomain.client_name` (se disponível) e/ou mapear `client_id`→`clients[]`.

### 3) Novo componente `src/components/external-domain/EditExternalDomainDialog.tsx`
**Objetivo:** UX consistente com `EditFirewallDialog`.

Comportamento:
- Quando abrir (`open=true` e `domain != null`):
  - Preencher estado local com:
    - `client_id` (somente leitura)
    - `domain` (somente leitura)
    - `agent_id` (editável)
    - `schedule` (editável, default manual quando não existir schedule ativo)
  - Buscar agents disponíveis para o `client_id` (mesmo padrão do `AddExternalDomainDialog`):
    - `supabase.from('agents').select('id,name,client_id').eq('client_id', client_id).eq('revoked', false).order('name')`
- Botões:
  - Cancelar: fecha dialog
  - Salvar: chama `onSave({ agent_id, schedule })` com loading state

Validações simples:
- Agent obrigatório (já é exigido hoje para análise; e também para manter consistência com o cadastro atual).
- Schedule sempre válido (manual/daily/weekly/monthly).

---

## Considerações / Edge cases
- Se o domínio não tiver schedule (manual), o dialog deve abrir com “Manual”.
- Se houver múltiplos schedules no futuro, o page hoje seleciona o “ativo” (ou o primeiro). Vamos manter essa lógica: ao salvar, substituímos tudo por um único schedule (ou nenhum se manual), igual ao firewall.
- Ao excluir, remover apenas tasks `pending/running` evita apagar histórico (completed/failed) caso seja útil manter rastreabilidade.

---

## Plano de validação (manual)
1) **Editar**
   - Abrir `/scope-external-domain/domains`
   - Clicar no ícone de lápis em um domínio
   - Alterar Agent e/ou Frequência
   - Salvar
   - Esperado:
     - Toast de sucesso
     - Tabela atualiza `Agent` e `Frequência`
2) **Excluir**
   - Clicar na lixeira
   - Confirmar exclusão
   - Esperado:
     - Toast de sucesso
     - Domínio some da tabela
     - Tarefas pending/running desse domínio são removidas do `agent_tasks`
3) **E2E**
   - Adicionar domínio → editar → analisar → excluir
   - Confirmar que o fluxo continua consistente e sem erros de permissão (RLS).

---

## Arquivos a alterar/criar
- Alterar:
  - `src/components/external-domain/ExternalDomainTable.tsx`
  - `src/pages/external-domain/ExternalDomainListPage.tsx`
- Criar:
  - `src/components/external-domain/EditExternalDomainDialog.tsx`
