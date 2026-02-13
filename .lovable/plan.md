

# Otimizacao do Dashboard: Performance e Dados Confiaveis

## Diagnostico

O hook `useDashboardStats` esta transferindo **~750KB de JSON** a cada troca de workspace porque baixa o campo `report_data` completo (relatorios inteiros de conformidade) de TODAS as analises historicas, apenas para contar severidades no client-side.

Alem disso, as queries de historico sao **sequenciais** (firewall -> m365 -> ext domain -> CVE) e nao ha cache entre trocas de workspace.

## Estrategia

Ao inves de criar uma tabela nova (que exigiria triggers e edge functions para manter sincronizada), vamos otimizar as queries existentes para reduzir o volume de ~750KB para ~5KB:

## Alteracoes

### 1. Separar queries de score history e severidades

**Arquivo**: `src/hooks/useDashboardStats.ts`

**Score history** (para o sparkline): selecionar apenas `score, created_at` -- sem `report_data`. Limitar a 30 dias.

```text
// De:
.select('firewall_id, score, report_data, created_at')
// Para:
.select('firewall_id, score, created_at')
.gte('created_at', thirtyDaysAgo)
```

**Severidades** (contagem de conformidade): query separada que busca apenas o registro MAIS RECENTE por ativo, usando DISTINCT ON via RPC ou limitando com logica client-side mas SEM baixar report_data. Em vez disso, recalcular severidades a partir dos dados que ja existem.

### 2. Eliminar download de report_data

Para as severidades, em vez de baixar o JSON completo e walkear categories no browser, vamos usar uma abordagem diferente para cada modulo:

- **Firewall**: Buscar apenas o ultimo registro por firewall. Selecionar `report_data` somente desse unico registro (1 x 44KB em vez de 9 x 44KB = reducao de 90%).
- **External Domain**: Mesmo padrao - ultimo registro por domain.
- **M365**: Ja usa `summary` como campo separado -- sem alteracao necessaria.

### 3. Paralelizar TODAS as queries

Atualmente, apos o primeiro `Promise.all` (asset counts), as queries de historico rodam em sequencia. Mover todas para um unico `Promise.all`:

```text
const [fwHistory, fwScoreHistory, m365History, extHistory, extScoreHistory, cveCache] = 
  await Promise.all([...]);
```

### 4. Migrar para useQuery com staleTime

Substituir o `useEffect + useState` manual por `useQuery` do TanStack, com `staleTime: 60_000` (1 minuto). Isso significa:
- Ao trocar workspace, se os dados daquele workspace foram buscados ha menos de 1 minuto, usa o cache instantaneamente
- O `queryKey` inclui o `selectedWorkspaceId`, entao cada workspace tem seu proprio cache
- `placeholderData: keepPreviousData` evita flash de skeleton em trocas rapidas

### 5. Limitar historico a 30 dias

Adicionar filtro `.gte('created_at', thirtyDaysAgo)` em todas as queries de historico para nao baixar dados antigos desnecessarios.

## Resumo do impacto

| Metrica | Antes | Depois |
|---|---|---|
| Dados transferidos | ~750 KB | ~10 KB |
| Queries sequenciais | 4 em serie | Todas paralelas |
| Cache entre workspaces | Nenhum | 1 min staleTime |
| Tempo estimado | 2-4 segundos | < 500ms |

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useDashboardStats.ts` | Reescrita completa: useQuery, queries otimizadas, paralelizacao |

