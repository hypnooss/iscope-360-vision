

## Plano: Redesenhar Topo do Firewall Analyzer

### Contexto Atual

**Firewall Analyzer (print 1)** possui:
- Cards de severidade horizontais básicos (Critical/High/Medium/Low)
- Card "Resumo de Eventos" com grid de métricas numéricas (Tráfego Negado, Auth Firewall, Auth VPN, Eventos IPS, Config, Web Filter, App Control, Anomalias)

**Surface Analyzer (print 2)** possui:
- Cards de estatísticas de alto nível do ativo (Ativos Expostos, Serviços, CVEs, Certificados)
- "PANORAMA POR CATEGORIA" com grid de cards visuais que incluem:
  - Ícone colorido temático
  - Título da categoria + contagem
  - Barra de severidade segmentada (critical/high/medium/low)
  - Badges de severidade
  - Clicável para drill-down

### Objetivo

Criar uma experiência visual similar ao Surface Analyzer no topo do Firewall Analyzer, organizando eventos por **categorias/tipos** em vez de severidades planas.

---

## Categorias Propostas

Com base nas métricas existentes em `AnalyzerMetrics`:

| Categoria | Label | Ícone | Cor | Métricas Associadas |
|-----------|-------|-------|-----|-------------------|
| `denied_traffic` | Tráfego Negado | shield | red-500 | `totalDenied`, `inboundBlocked`, `outboundBlocked` |
| `fw_authentication` | Autenticação Firewall | lock | orange-500 | `firewallAuthFailures`, `firewallAuthSuccesses` |
| `vpn_authentication` | Autenticação VPN | wifi | amber-500 | `vpnFailures`, `vpnSuccesses` |
| `ips_events` | Eventos IPS | alert-triangle | rose-500 | `ipsEvents` |
| `config_changes` | Alterações de Config | server | purple-500 | `configChanges`, `configChangeDetails` |
| `web_filter` | Filtragem Web | filter | blue-500 | `webFilterBlocked`, `topWebFilterCategories`, `topWebFilterUsers` |
| `app_control` | Controle de Apps | app-window | cyan-500 | `appControlBlocked`, `topAppControlApps`, `topAppControlUsers` |
| `anomalies` | Anomalias | zap | yellow-500 | `anomalyEvents`, `anomalyDropped`, `topAnomalySources`, `topAnomalyTypes` |
| `botnet` | Detecções Botnet | bug | red-600 | `botnetDetections`, `botnetDomains` |
| `sessions` | Sessões Ativas | activity | green-500 | `activeSessions` |

Cada categoria pode ter **severidades automáticas** baseadas em thresholds:
- **Critical**: eventos de alta frequência ou categorias críticas (IPS, Botnet, Auth Failures > 100)
- **High**: volumes médios ou falhas significativas
- **Medium/Low**: informativo

---

## Estrutura Visual

### 1. Cards de Estatísticas Gerais (topo)
Substituir os 4 cards de severidade por cards de **métricas executivas**:

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Eventos Totais  │ Taxa Bloqueio   │ Autenticações   │ Score Segurança │
│   33,811        │    3,020 (8%)   │   595/33,811    │       82        │
│ [icon]          │ [icon]          │ [icon]          │ [gauge icon]    │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

- **Eventos Totais**: `totalEvents`
- **Taxa Bloqueio**: `totalDenied / totalEvents * 100`
- **Autenticações**: `(firewallAuthSuccesses + vpnSuccesses) / totalEvents`
- **Score Segurança**: calculado com base em falhas (opcional, ou remover)

### 2. CATEGORIAS DE EVENTOS (grid 3x3)
Similar ao `CategoryOverviewGrid` do Surface Analyzer:

```
┌──────────────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ [shield-red] Tráfego Negado  │ [lock-orange] Auth Firewall  │ [wifi-amber] Auth VPN        │
│ 3,020 eventos                │ 33,811 eventos               │ 595 eventos                  │
│ ▓▓▓▓▓▓░░░░░░░░░░░ (barra)    │ ▓▓▓░░░░░░░░░░░░░░ (barra)    │ ░░░░░░░░░░░░░░░░░ (barra)    │
│ 9 Critical | 3 High          │ 33,811 Fail | 0 OK          │ 590 Fail | 5 OK             │
└──────────────────────────────┴──────────────────────────────┴──────────────────────────────┘
│ [alert-triangle] IPS         │ [server-purple] Config       │ [filter-blue] Web Filter     │
│ 0 eventos                    │ 0 alterações                 │ 0 bloqueios                  │
└──────────────────────────────┴──────────────────────────────┴──────────────────────────────┘
│ [app-window] App Control     │ [zap-yellow] Anomalias       │ [bug-red] Botnet             │
│ 0 bloqueios                  │ 0 eventos                    │ 0 detecções                  │
└──────────────────────────────┴──────────────────────────────┴──────────────────────────────┘
```

Cada card:
- Ícone colorido temático
- Título + contagem principal
- Barra segmentada mostrando distribuição de severidade (se aplicável)
- Badges com breakdown (ex: "590 Fail | 5 OK" para VPN)
- Clicável → abre sheet com detalhes (rankings de IPs/Países/Categorias)

---

## Implementação

### 1. Criar novos componentes

#### `src/components/firewall/AnalyzerStatsCards.tsx`
Card de estatísticas gerais (4 cards no topo).

#### `src/components/firewall/AnalyzerCategoryGrid.tsx`
Grid de categorias estilizado (similar ao `CategoryOverviewGrid`).

#### `src/components/firewall/AnalyzerCategorySheet.tsx`
Sheet lateral para drill-down em uma categoria específica (rankings de IPs, países, etc.).

### 2. Atualizar tipos

Adicionar em `src/types/analyzerInsights.ts`:
```typescript
export type AnalyzerEventCategory =
  | 'denied_traffic'
  | 'fw_authentication'
  | 'vpn_authentication'
  | 'ips_events'
  | 'config_changes'
  | 'web_filter'
  | 'app_control'
  | 'anomalies'
  | 'botnet'
  | 'sessions';

export interface AnalyzerCategoryInfo {
  key: AnalyzerEventCategory;
  label: string;
  icon: string;
  colorHex: string;
  description: string;
}

export const ANALYZER_CATEGORY_INFO: Record<AnalyzerEventCategory, AnalyzerCategoryInfo> = { ... };
```

### 3. Refatorar `AnalyzerDashboardPage.tsx`

- **Remover** os 4 cards de severidade atuais (linhas 604-618)
- **Remover** o card "Resumo de Eventos" (linhas 621-748)
- **Adicionar** `<AnalyzerStatsCards snapshot={snapshot} />` logo após o breadcrumb
- **Adicionar** `<AnalyzerCategoryGrid snapshot={snapshot} onCategoryClick={handleCategoryClick} />` após os stats
- Manter o mapa de ataque na mesma posição

### 4. Lógica de Severidade por Categoria

Cada categoria calcula severidades com base em thresholds:
```typescript
function calculateCategorySeverity(category: AnalyzerEventCategory, metrics: AnalyzerMetrics) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  
  switch (category) {
    case 'fw_authentication':
      const failRate = metrics.firewallAuthFailures / (metrics.firewallAuthFailures + metrics.firewallAuthSuccesses);
      if (failRate > 0.5) counts.critical++;
      else if (failRate > 0.2) counts.high++;
      break;
    case 'botnet':
      if (metrics.botnetDetections > 0) counts.critical = metrics.botnetDetections;
      break;
    // ... outros casos
  }
  
  return counts;
}
```

---

## Resumo de Arquivos

### Novos Arquivos
- `src/components/firewall/AnalyzerStatsCards.tsx`
- `src/components/firewall/AnalyzerCategoryGrid.tsx`
- `src/components/firewall/AnalyzerCategorySheet.tsx`

### Arquivos Modificados
- `src/types/analyzerInsights.ts` (adicionar categorias e info)
- `src/pages/firewall/AnalyzerDashboardPage.tsx` (refatorar topo)

### Reutilização de Componentes
- UI base: `Card`, `CardContent`, `Badge` (já existente)
- Inspiração visual: `CategoryOverviewGrid`, `SeverityCards` (Surface Analyzer)
- Padrão de severidade segmentada (barra horizontal com cores)

