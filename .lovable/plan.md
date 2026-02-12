
# Otimizar Performance da Dashboard

## Problema Identificado

A funcao `fetchDashboardData()` no `DashboardPage.tsx` executa **5 queries sequenciais em cascata** (waterfall), onde cada query espera o resultado da anterior antes de executar:

```text
Query 1+2 (paralelo): clients + firewalls ............ ~200ms
    |
    v  aguarda resultado
Query 3: analysis_history (com firewallIds) ........... ~200ms
    |
    v  aguarda resultado
Query 4: analysis_history recentes .................... ~200ms
    |
    v  aguarda resultado
Query 5: firewalls (nomes) ............................ ~200ms
    |
    v  aguarda resultado
Query 6: clients (nomes) ............................. ~200ms
                                            Total: ~1000ms+
```

Alem disso, a query de `analysis_history` busca ate 100 registros apenas para calcular media e contar criticos -- dados que poderiam vir de forma mais eficiente.

## Solucao

### 1. Paralelizar todas as queries independentes

Reorganizar `fetchDashboardData()` para executar o maximo de queries em paralelo:

- **Batch 1** (paralelo): `clients count`, `firewalls (id, name, client_id, last_score)`, `analysis_history recentes (top 5 com firewall_id)`
- **Batch 2**: Nenhum -- todos os dados necessarios ja vem no Batch 1

### 2. Eliminar queries redundantes

- A query de `firewalls` ja traz `id, name, client_id` -- nao precisa buscar novamente para resolver nomes
- O campo `last_score` nos firewalls pode ser usado para calcular score medio e contar criticos, eliminando a query de `analysis_history` para estatisticas
- Os nomes dos clientes podem ser buscados no mesmo batch inicial

### 3. Resultado Otimizado

```text
Query 1+2+3+4 (todas paralelas):
  - clients (id, name)
  - firewalls (id, name, client_id, last_score)
  - analysis_history recentes (top 5)
                                            Total: ~200ms (1 round-trip)
```

Reducao de **5 round-trips para 1**, com ganho estimado de **80% no tempo de carregamento**.

## Detalhes Tecnicos

### Arquivo: `src/pages/DashboardPage.tsx`

Reescrever `fetchDashboardData()` para:

1. Executar todas as queries em um unico `Promise.all`:
   - `clients` com `select('id, name')`
   - `firewalls` com `select('id, name, client_id, last_score')`
   - `analysis_history` com `select('id, score, created_at, firewall_id').order('created_at', { ascending: false }).limit(5)`

2. Calcular stats a partir dos dados de `firewalls`:
   - `totalFirewalls`: count do array
   - `averageScore`: media de `last_score` dos firewalls que tem score
   - `criticalIssues`: firewalls com `last_score < 50`

3. Resolver nomes de firewall e cliente para analises recentes usando Maps construidos a partir dos dados ja buscados no batch, sem queries adicionais.

4. Manter toda a logica de workspace filtering (preview mode).

### Resultado

| Metrica | Antes | Depois |
|---------|-------|--------|
| Queries ao Supabase | 5-6 sequenciais | 3 paralelas |
| Round-trips de rede | 5 | 1 |
| Tempo estimado | ~1000ms+ | ~200-300ms |
