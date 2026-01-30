
## Objetivo
Fazer com que **Domínio Externo > Domínios Externos** tenha o botão **Adicionar Domínio** abrindo uma tela (modal) de cadastro **espelhada do cadastro de firewall**, contendo **Domínio Externo, Agent, Cliente e Frequência de Análise**, e já preparada para funcionar com Supabase (criar/listar).

## O que existe hoje (diagnóstico rápido)
- A página **`/scope-external-domain/domains`** (`src/pages/external-domain/ExternalDomainListPage.tsx`) está **placeholder**:
  - Botão “Adicionar Domínio” apenas mostra toast “Funcionalidade em desenvolvimento”.
  - Não busca dados do Supabase ainda (lista vazia por padrão).
- O fluxo “espelho” que você quer já existe no módulo Firewall:
  - `src/components/firewall/AddFirewallDialog.tsx` (modal com formulário)
  - `src/pages/firewall/FirewallListPage.tsx` (carrega clientes/agentes, abre modal e salva no banco)

## Decisões que vou seguir (com base no que você respondeu)
- Implementar **no mesmo modelo do cadastro de firewall**:
  - Um **Dialog** (modal) com formulário.
  - Campos: **Cliente**, **Agent**, **Domínio Externo**, **Descrição (opcional)**, **Frequência de análise**.
  - Agent filtrado por Cliente (igual firewall).
- Para “estar funcionando” de fato, vou implementar também o **mínimo de banco** para salvar e listar:
  - Criar tabela **`external_domains`**
  - Criar tabela **`external_domain_schedules`** (equivalente ao `analysis_schedules` do firewall)
  - Adicionar **RLS policies** seguindo o mesmo padrão do firewall (por `has_client_access()` + permissão por módulo via `get_module_permission()`).

> Observação: hoje não existe tabela `external_domains` no Supabase; sem isso o cadastro até abriria, mas não teria persistência nem listagem real. O “funcionando” aqui vai significar: abre modal, valida, salva, e aparece na lista.

---

## Escopo de implementação (alto nível)
### 1) Banco de dados (Supabase / migrations)
Criar migration(s) em `supabase/migrations/` para:

**Tabela `external_domains`**
- Colunas propostas:
  - `id uuid primary key default gen_random_uuid()`
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()`
  - `created_by uuid null`
  - `client_id uuid not null` (relacionamento lógico com `clients`)
  - `agent_id uuid null` (relacionamento lógico com `agents`)
  - `name text not null` (nome amigável)
  - `domain text not null` (domínio/URL informado)
  - `description text null`
  - `status text not null default 'pending'` (por enquanto como texto simples para não travar em enum)
  - `last_scan_at timestamptz null`
  - `last_score integer null`

**Tabela `external_domain_schedules`**
- Colunas propostas:
  - `id uuid primary key default gen_random_uuid()`
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()`
  - `created_by uuid null`
  - `domain_id uuid not null` (ref. `external_domains.id`, com `on delete cascade`)
  - `frequency schedule_frequency not null` (reusar o enum já existente `schedule_frequency`)
  - `is_active boolean not null default true`
  - `next_run_at timestamptz null`

**RLS**
- Ativar RLS nas duas tabelas.
- Políticas (mesmo padrão do firewall):
  - SELECT: permitir se `has_client_access(auth.uid(), client_id)` (no caso do schedule, via join do domain).
  - ALL (insert/update/delete): permitir se:
    - `has_client_access(...)` E `get_module_permission(auth.uid(), 'external_domain') IN ('edit','full')`
- (Opcional, mas recomendado) Índices:
  - `external_domains(client_id)`
  - `external_domains(agent_id)`
  - `external_domain_schedules(domain_id)`

### 2) UI: criar modal “Adicionar Domínio”
Criar um componente novo, espelhado de `AddFirewallDialog`, por exemplo:
- `src/components/external-domain/AddExternalDomainDialog.tsx`

Comportamento:
- Modal (Radix Dialog) com ScrollArea.
- Campos (na ordem, alinhado ao firewall):
  1. **Cliente*** (Select) – carregado de `clients`
  2. **Agent*** (Select) – carregado de `agents` filtrando por `client_id` e `revoked=false`
  3. **Domínio Externo*** (Input) – validação
  4. **Nome (opcional)** (Input) – ou derivar automaticamente do domínio se você preferir
  5. **Descrição** (Textarea)
  6. **Frequência de Análise** (Select: manual/daily/weekly/monthly)

Validação (client-side):
- Cliente obrigatório.
- Agent obrigatório (como você pediu).
- Domínio obrigatório.
- Criar função de validação específica (ex.: `getExternalDomainError()`), aceitando:
  - `example.com` (sem protocolo) **ou**
  - `https://example.com` (com protocolo)
  - Bloquear espaços, caminhos e query (`/path`, `?x=1`) para manter consistente com o estilo do projeto.
- Botão “Adicionar” desabilitado com erro de validação.

### 3) Lógica: salvar no Supabase e atualizar lista
No modelo do firewall:

**Em `ExternalDomainListPage.tsx`:**
- Carregar dados reais:
  - `clients` (para o modal)
  - `agents` (para o modal ou buscar sob demanda ao trocar cliente, como firewall)
  - `external_domains` (lista)
  - `external_domain_schedules` (para mostrar schedule na lista, se você quiser já exibir)
- Substituir o botão atual por:
  - `<AddExternalDomainDialog clients={clients} onDomainAdded={handleAddDomain} />`

**Função `handleAddDomain`**
- `insert` em `external_domains` com:
  - `client_id`, `agent_id`, `domain`, `name`, `description`, `created_by`
  - `status` inicial: `pending` (ou `active` se você preferir)
- Se `schedule !== 'manual'`, inserir em `external_domain_schedules`.

**Após salvar:**
- Recarregar lista (ou usar update local).
- Toast de sucesso/erro.

### 4) Ajustes de permissões e visibilidade
- Manter a regra existente da página:
  - Só mostra botão se `hasPermission('external_domain', 'edit')`.
- Garantir que as políticas do banco estejam alinhadas com essa permissão:
  - usar `get_module_permission(auth.uid(), 'external_domain')`.

### 5) QA / Testes manuais (checklist objetivo)
1. Logar e acessar: **Domínio Externo > Domínios Externos**
2. Clicar **Adicionar Domínio**:
   - Modal abre
   - Cliente obrigatório
   - Agent só habilita depois de escolher Cliente
3. Preencher e salvar:
   - Inserção no Supabase ocorre sem erro de RLS
   - Novo domínio aparece na lista
4. Validar que um usuário sem permissão “edit”:
   - Não vê o botão
   - Não consegue inserir mesmo via chamadas diretas (RLS bloqueia)

---

## Arquivos que serão alterados/criados (quando você aprovar)
- `src/pages/external-domain/ExternalDomainListPage.tsx` (trocar toast por modal + fetch real)
- `src/components/external-domain/AddExternalDomainDialog.tsx` (novo, espelhado do firewall)
- `src/lib/urlValidation.ts` (opcional: adicionar helper de validação para domínio externo, ou criar util novo)
- `supabase/migrations/....sql` (nova migration criando tabelas + RLS)

---

## Pontos de atenção / riscos
- Como o módulo Domínio Externo ainda está “placeholder” em Execuções/Relatórios, o cadastro vai funcionar e listar, mas **essas outras páginas continuarão sem dados** até implementarmos tabelas e fluxo de tarefas/relatórios.
- RLS precisa ser bem alinhado ao modelo `has_client_access` para evitar:
  - usuário vendo domínios de outros clientes
  - usuário não conseguindo salvar por falta de policy

---

## Próximo passo após este (sugestão)
Depois do cadastro estar ok, evoluir para:
- iniciar “análise do domínio” (criar tarefas no `agent_tasks` com `target_type = 'external_domain'`)
- preencher Execuções e Relatórios com dados reais (tabelas e edge functions)
