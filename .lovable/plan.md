

## Ajustar Colaboração Analyzer para o padrão Entra ID — Cards + Sheets com detalhamento e exportação

### Situação atual vs. desejada

**Hoje (Colaboração):** Cards com barra de cor única + Sheet simples com apenas MetricCards em grid 2x2, sem abas, sem listas, sem exportação.

**Referência (Entra ID):** Cards com barras multi-segmento e badges coloridas + Sheet com abas inline (underline), métricas em grid de 3-4 colunas, barras proporcionais, listas pesquisáveis (`GenericDetailList`), e botão "Exportar" para Excel (xlsx).

### Limitação de dados atual

A edge function `collaboration-dashboard` retorna **apenas números agregados** (ex: `teams.public: 12`, `sharepoint.inactiveSites: 5`). Não retorna arrays de detalhes (nomes dos teams, URLs dos sites, lista de convidados). Para ter listas pesquisáveis e exportação, precisamos enriquecer o backend.

### Plano em duas fases

#### Fase 1 — Frontend (agora)

**1. `TeamsAnalyzerCategoryGrid.tsx`** — Atualizar cards para padrão visual Entra ID:
- Adicionar `splits` ao `CategoryStats`
- `public_teams`: splits [Públicas (red), Privadas (teal)]
- `guest_access`: splits [Com Convidados (amber), Sem Convidados (green)]
- `sharepoint_sites`: splits [Ativos (green), Inativos (indigo)]
- `external_sharing`: splits [Habilitados (red), Desabilitados (green)]
- `inactive_sites`: splits [Inativos (indigo), Ativos (green)]
- Renderizar barras multi-segmento e badges coloridas por segmento

**2. `TeamsCategorySheet.tsx`** — Reescrever para padrão Entra ID:
- Adicionar `ProportionalBar`, `MetricCard` com ícone, `ExportButton` e `downloadXlsx` (reutilizar padrão existente)
- Cada categoria terá aba "Status Geral" com grid de métricas + barra proporcional
- Categorias com dados detalhados futuros terão abas de listagem (preparar estrutura)
- Exportação Excel dos dados agregados disponíveis (expandível quando o backend retornar detalhes)

**3. `useCollaborationDashboard.ts`** — Expandir interface para aceitar arrays opcionais de detalhes (backward-compatible):
- `teams.teamDetails?: Array<{ displayName, visibility, hasGuests, memberCount }>`
- `sharepoint.siteDetails?: Array<{ displayName, webUrl, lastActivity, storageUsedGB, externalSharing }>`

#### Fase 2 — Backend (posterior)

**4. Edge function `collaboration-dashboard`** — Enriquecer retorno com arrays de detalhes:
- Incluir `teamDetails` com nome, visibilidade, se tem guests, contagem de membros
- Incluir `siteDetails` com nome, URL, última atividade, storage usado, compartilhamento externo
- Dados já são coletados na função (ex: `allTeamGroups`, `allSites`, `rows` do CSV), só precisam ser formatados e retornados

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/components/m365/teams/TeamsAnalyzerCategoryGrid.tsx` | Splits + barras multi-segmento + badges coloridas |
| `src/components/m365/teams/TeamsCategorySheet.tsx` | Reescrita completa: abas, métricas, barras, export |
| `src/hooks/useCollaborationDashboard.ts` | Interface expandida (campos opcionais) |
| `supabase/functions/collaboration-dashboard/index.ts` | Retornar arrays de detalhes |

