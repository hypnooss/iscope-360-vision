
# Adicionar CVEs por Severidade nos Cards do Dashboard

## Visao Geral

Criar um sistema de cache de CVEs com job agendado (diario) que armazena contagens de severidade no banco de dados. O Dashboard lera esses dados do cache, garantindo carregamento rapido. CVEs serao exibidos apenas nos cards de Firewall e Microsoft 365 (Dominio Externo nao exibe CVEs).

## Layout Atualizado do Card

```text
+--------------------------------------------------------------+
| [icon] Firewall                                        [->]  |
|                                                               |
|                    CVEs              Conformidade              |
|  [ ScoreGauge ]    ! 5 Critico       ! 26 Critico            |
|  [   63      ]    /!\ 12 Alto       /!\ 60 Alto              |
|  [  ATENCAO  ]    (i) 3 Medio       (i) 69 Medio             |
|                    (i) 0 Baixo       (i) 5 Baixo              |
|                                                               |
|  Ultima analise: ha 28 minutos                                |
+--------------------------------------------------------------+
```

Para modulos sem CVEs (Dominio Externo), o layout permanece como esta hoje (gauge + severidades de conformidade).

## Arquitetura

```text
[Cron diario 06:00 UTC]
        |
        v
[Edge Function: refresh-cve-cache]
        |
        +-- Busca firmware versions dos firewalls
        |   +-- Chama fortigate-cve para cada versao
        |
        +-- Chama m365-cves (3 meses)
        |
        v
[Tabela: cve_severity_cache]
  module_code | client_id | critical | high | medium | low | updated_at
        |
        v
[useDashboardStats] le do cache
        |
        v
[ModuleHealthCard] exibe duas colunas de badges
```

## Etapas de Implementacao

### 1. Criar tabela `cve_severity_cache`

Migracao SQL para criar a tabela:

- `id` (uuid, PK)
- `module_code` (text, ex: 'firewall', 'm365')
- `client_id` (uuid, FK para clients, nullable - null = global/todos)
- `critical` (integer, default 0)
- `high` (integer, default 0)
- `medium` (integer, default 0)
- `low` (integer, default 0)
- `total_cves` (integer, default 0)
- `updated_at` (timestamptz, default now())
- Unique constraint em (module_code, client_id)
- RLS: usuarios podem ver caches dos clientes que tem acesso

### 2. Criar Edge Function `refresh-cve-cache`

Uma nova Edge Function que:

1. **Firewall**: Para cada client_id com firewalls:
   - Busca firmware versions do `analysis_history`
   - Invoca `fortigate-cve` internamente para cada versao unica
   - Agrupa CVEs por severidade
   - Upsert no `cve_severity_cache` com `module_code = 'firewall'` e `client_id`

2. **M365**: Chamada global (CVEs sao os mesmos para todos os tenants):
   - Invoca `m365-cves` com 3 meses
   - Conta CVEs por severidade
   - Upsert no `cve_severity_cache` com `module_code = 'm365'` e `client_id = NULL`

A funcao usa `service_role` para escrever no banco.

### 3. Configurar Cron Job

SQL (via insert tool) para agendar execucao diaria as 06:00 UTC:

```text
cron.schedule('refresh-cve-cache', '0 6 * * *', ...)
```

### 4. Atualizar `useDashboardStats`

- Adicionar campo `cveSeverities` ao tipo `ModuleHealth`:
  ```text
  cveSeverities?: { critical: number; high: number; medium: number; low: number } | null
  ```
- Buscar dados de `cve_severity_cache` em paralelo com as outras queries
- Mapear para os modulos correspondentes (firewall, m365)

### 5. Atualizar `GeneralDashboardPage`

- Modificar `ModuleHealthCard` para aceitar `cveSeverities` opcional
- Quando `cveSeverities` existe, renderizar duas colunas de badges lado a lado:
  - Coluna esquerda: "CVEs" (com header)
  - Coluna direita: "Conformidade" (com header, dados atuais)
- Quando `cveSeverities` nao existe (Dominio Externo), manter layout atual com uma coluna

## Arquivos Modificados/Criados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabela `cve_severity_cache` com RLS |
| `supabase/functions/refresh-cve-cache/index.ts` | Nova Edge Function para popular o cache |
| `supabase/config.toml` | Adicionar config da nova funcao |
| `src/hooks/useDashboardStats.ts` | Adicionar leitura do cache de CVEs |
| `src/pages/GeneralDashboardPage.tsx` | Layout com duas colunas de badges |
| SQL (insert tool) | Criar cron job diario |

## Consideracoes

- Na primeira implantacao, o cache estara vazio ate o cron rodar. A Edge Function pode ser chamada manualmente para popular o cache imediatamente.
- O M365 usa `client_id = NULL` porque as CVEs sao globais (mesmos CVEs para todos os tenants). Firewall usa `client_id` especifico porque as CVEs dependem da versao de firmware de cada cliente.
- O cron roda uma vez por dia, o que e suficiente pois CVEs nao mudam com frequencia.
