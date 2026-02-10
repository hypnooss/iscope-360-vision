

# Repaginar o Dashboard Geral com insights reais e filtro por workspace

## Visao geral

Transformar o Dashboard Geral de uma pagina com placeholders e dados minimos em um painel executivo rico, com score consolidado, contagem real de ativos por modulo, resumo de severidades, timeline de analises recentes e status dos agents. O layout sera organizado em secoes visuais claras para nao sobrecarregar a tela.

## Isolamento de dados por workspace

O padrao ja existente no projeto sera replicado:

```text
Super Admin / Super Suporte:
  - workspaceIds = null (sem filtro, ve tudo)
  - No preview mode: usa previewTarget.workspaces

Workspace Admin / User:
  - RLS do Supabase ja filtra por client_id automaticamente
  - Queries retornam apenas dados do workspace do usuario
```

Todas as queries do dashboard seguirao o mesmo padrao de `workspaceIds` que ja existe em `GeneralDashboardPage.tsx` e `DashboardPage.tsx`, garantindo que clientes vejam apenas seus proprios dados.

## Layout proposto

```text
+---------------------------------------------------------------+
|  Dashboard Geral                                    [data]     |
|  Visao consolidada de seguranca                                |
+---------------------------------------------------------------+
|                                                                |
|  SECAO 1 - Score e Ativos (hero)                               |
|  +------------------+  +------+ +------+ +------+ +------+    |
|  |   ScoreGauge     |  | FW   | | M365 | | Ext  | | Agts |    |
|  |   Consolidado    |  | 12   | | 3    | | 8    | | 5/7  |    |
|  |   78%            |  |      | |      | |      | |      |    |
|  +------------------+  +------+ +------+ +------+ +------+    |
|                                                                |
|  SECAO 2 - Severidades cross-module                            |
|  +----------+ +--------+ +--------+ +--------+                |
|  | Criticos | | Altos  | | Medios | | Baixos |                |
|  |    5     | |   12   | |   23   | |   8    |                |
|  +----------+ +--------+ +--------+ +--------+                |
|                                                                |
|  SECAO 3 - Atividade recente (timeline unificada)              |
|  +----------------------------------------------------------+ |
|  | [icone FW]  FortiGate-HQ  |  ClienteA  |  82%  | 05/02  | |
|  | [icone M365] Tenant Corp  |  ClienteB  |  71%  | 04/02  | |
|  | [icone Ext]  example.com  |  ClienteA  |  90%  | 03/02  | |
|  +----------------------------------------------------------+ |
|                                                                |
+---------------------------------------------------------------+
```

## Secoes detalhadas

### Secao 1 - Score consolidado + Ativos monitorados

**Score Gauge (lado esquerdo):**
- Calcula a media ponderada dos scores mais recentes de Firewall (`analysis_history`) e M365 (`m365_posture_history`)
- Usa o componente `ScoreGauge` existente com tamanho `md`
- Se nao houver dados de nenhum modulo, exibe `--` com label "Sem dados"

**Cards de ativos (lado direito, 4 cards em grid):**

| Card | Fonte | Icone | Cor |
|------|-------|-------|-----|
| Firewalls | `firewalls` count | Shield | orange-500 |
| Tenants M365 | `m365_tenants` count (status connected/partial) | Cloud | blue-500 |
| Dominios Externos | `external_domains` count | Network | purple-500 |
| Agents | `agents` (ativos/total) | Server | emerald-500 |

Cada card mostra o total e, quando o modulo esta disponivel, um botao "Acessar modulo" (reutilizando o padrao atual). Cards de modulos nao contratados aparecem com `opacity-60` e sem botao.

### Secao 2 - Resumo de severidades cross-module

4 StatCards (reutilizando o componente existente) com contagens agregadas de:
- **Firewall**: issues com score < thresholds do `analysis_history` mais recente de cada firewall
- **M365**: severidades do campo `summary` da `m365_posture_history` mais recente de cada tenant

Os dados vem do campo `summary` (JSON) que ja contem `critical`, `high`, `medium`, `low` contadores.

### Secao 3 - Timeline unificada de analises recentes

Card com lista das ultimas 8 analises de qualquer modulo, ordenadas por data:
- **Firewall**: `analysis_history` com join em `firewalls` e `clients`
- **M365**: `m365_posture_history` com join em `m365_tenants` e `clients`
- **Ext Domain**: `external_domain_analyses` com join em `external_domains` e `clients`

Cada item mostra: icone do modulo, nome do recurso, nome do cliente, score e data.

## Alteracoes tecnicas

### 1. Novo hook: `src/hooks/useDashboardStats.ts`

Hook dedicado que centraliza todas as queries do dashboard geral:

```typescript
interface DashboardStats {
  // Assets
  totalFirewalls: number;
  totalM365Tenants: number;
  totalExternalDomains: number;
  agentsOnline: number;
  agentsTotal: number;
  
  // Consolidated score
  consolidatedScore: number | null;
  
  // Severity summary (cross-module)
  severities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  
  // Recent activity
  recentActivity: Array<{
    id: string;
    module: 'firewall' | 'm365' | 'external_domain';
    resourceName: string;
    clientName: string;
    score: number;
    date: string;
  }>;
}
```

O hook recebe `workspaceIds` (do PreviewContext) e aplica filtros `.in('client_id', workspaceIds)` em todas as queries quando necessario, seguindo o padrao existente.

Queries executadas em paralelo com `Promise.all`:
1. Count firewalls
2. Count m365_tenants (connected/partial)
3. Count external_domains
4. Count agents (total + filtro last_seen > 5min para "online")
5. Ultimo `analysis_history` por firewall (score)
6. Ultimo `m365_posture_history` por tenant (summary + score)
7. Ultimas 8 analises unificadas (3 queries separadas, merge + sort por data)

### 2. Refatorar: `src/pages/GeneralDashboardPage.tsx`

Substituir o conteudo atual por:
- Importar `useDashboardStats`, `useEffectiveModules`, `ScoreGauge`, `StatCard`
- **Secao 1**: flex row com ScoreGauge + grid 2x2 de cards de ativos
- **Secao 2**: grid de 4 StatCards de severidade
- **Secao 3**: Card com lista de atividades recentes (mesmo padrao visual do `DashboardPage.tsx` existente)
- Skeleton loading para todas as secoes

### 3. Visibilidade condicional por modulo

Os cards de ativos e as contagens de severidade so incluem dados de modulos que o usuario tem acesso:

```typescript
const hasFirewall = hasEffectiveModuleAccess('scope_firewall');
const hasM365 = hasEffectiveModuleAccess('scope_m365');
const hasExtDomain = hasEffectiveModuleAccess('scope_external_domain');
```

Modulos sem acesso mostram o card com `opacity-60`, valor `--` e sem botao de acesso.

### Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `src/hooks/useDashboardStats.ts` | Criar (hook com todas as queries) |
| `src/pages/GeneralDashboardPage.tsx` | Refatorar (novo layout com 3 secoes) |

Nenhuma alteracao no backend ou em Edge Functions.

