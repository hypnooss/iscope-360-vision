
# Separar ativos por categoria com tabelas individuais e coluna Agent

## Objetivo

Substituir a tabela unica de ativos por 3 secoes separadas por modulo (Firewalls, Dominios Externos, Tenants M365), cada uma com sua propria tabela. Trocar a coluna "Tipo" pela coluna "Agent".

## Mudancas

### Arquivo: `src/pages/EnvironmentPage.tsx`

**1. Atualizar a query para incluir dados de agent**

- Firewalls: fazer join com `agents` via `agent_id` para trazer `agents.name`
- External Domains: fazer join com `agents` via `agent_id` para trazer `agents.name`
- M365 Tenants: fazer join com `m365_tenant_agents` e `agents` para trazer nome do agent vinculado

Adicionar campo `agentName: string | null` ao `UnifiedAsset`.

**2. Separar assets filtrados por tipo**

Em vez de renderizar uma unica tabela com `filtered`, criar 3 agrupamentos:
- `filteredFirewalls = filtered.filter(a => a.type === 'firewall')`
- `filteredDomains = filtered.filter(a => a.type === 'external_domain')`
- `filteredTenants = filtered.filter(a => a.type === 'm365_tenant')`

**3. Criar componente de secao reutilizavel**

Cada secao tera:
- Titulo com icone e badge de contagem (ex: "Firewalls (3)")
- Tabela com colunas: Nome, Agent, Workspace, Score, Status, Acoes
- A coluna "Tipo" deixa de existir (ja esta implicita na secao)
- Se a secao nao tiver itens (apos filtro), exibir mensagem "Nenhum ativo encontrado"

**4. Layout das secoes**

```text
[Stats Cards]
[Search]
--- Firewalls (icon Shield, cor orange) ---
  [Tabela: Nome | Agent | Workspace | Score | Status | Acoes]
--- Dominios Externos (icon Globe, cor teal) ---
  [Tabela: Nome | Agent | Workspace | Score | Status | Acoes]
--- Tenants M365 (icon Cloud, cor blue) ---
  [Tabela: Nome | Agent | Workspace | Score | Status | Acoes]
```

Cada secao so aparece se houver ativos daquele tipo no workspace (antes do filtro de busca). Se apos o filtro a secao ficar vazia, mostrar mensagem inline.

**5. Detalhes da coluna Agent**

- Se o ativo tiver agent vinculado: exibir nome do agent
- Se nao tiver: exibir "—" em texto muted
