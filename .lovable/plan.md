

# Padronizar a pagina Alteracoes de Configuracao

## Problema

A pagina `AnalyzerConfigChangesPage` nao segue o padrao das demais sub-paginas do Analyzer (como Insights e Critical). Faltam:

1. Botao "Voltar" ao lado do titulo
2. Seletor de Workspace (para Super Roles)
3. Query de firewalls escopada por workspace
4. Hooks `usePreview`, `useEffectiveAuth`, `useWorkspaceSelector`
5. Espacamento padrao (`mb-8` no cabecalho)

## Mudancas no arquivo `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

### 1. Adicionar imports faltantes

- `usePreview` de `@/contexts/PreviewContext`
- `useEffectiveAuth` de `@/hooks/useEffectiveAuth`
- `useWorkspaceSelector` de `@/hooks/useWorkspaceSelector`
- `useQuery` de `@tanstack/react-query`
- Icones: `ArrowLeft`, `Building2`
- Remover `Server` (sera substituido pelo botao voltar)

### 2. Adicionar hooks e logica de workspace

- Calcular `isSuperRole` a partir de `effectiveRole`
- Query de workspaces (`clients`) habilitada para super roles
- `useWorkspaceSelector` para persistencia
- Substituir query manual de firewalls (`useEffect` + `setState`) por `useQuery` escopado por `selectedWorkspaceId`
- Auto-selecionar primeiro firewall quando a lista muda

### 3. Reestruturar cabecalho

**Antes:**
- Icone Server + Titulo
- Seletor firewall + botao refresh a direita

**Depois (padrao Insights):**
- Botao Voltar (ghost, navega para `/scope-firewall/analyzer`) + Titulo + Subtitulo
- Seletor Workspace (condicional) + Seletor Firewall + Botao Refresh a direita
- Espacamento `mb-8` (em vez de `mb-6`)

### 4. Interface FirewallOption

Adicionar campo `client_id` para filtro por workspace: `{ id: string; name: string; client_id: string; }`

## Resultado Visual

O cabecalho ficara identico ao da pagina Insights:
- Botao voltar (seta) a esquerda do titulo
- Subtitulo abaixo
- Seletores de Workspace e Firewall alinhados a direita
- Filtros de busca e categoria abaixo, como ja estao

## Arquivo a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/pages/firewall/AnalyzerConfigChangesPage.tsx` | Adicionar hooks padrao, botao voltar, seletor workspace, query escopada |

