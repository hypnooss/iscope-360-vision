
# Vincular Dashboard aos Modulos Ativos do Sistema

## Contexto

Atualmente, os cards de modulo (Firewall, M365, Dominio Externo) e os itens do card Infraestrutura sao definidos de forma **hardcoded** no `GeneralDashboardPage.tsx`. Se um novo modulo for ativado na tabela `modules`, ele nao aparece automaticamente no dashboard.

O objetivo e criar um vinculo dinamico: o dashboard deve refletir os modulos ativos que o usuario tem permissao de acessar, usando os dados ja existentes em `effectiveUserModules` (do hook `useEffectiveModules`).

## Arquitetura proposta

Criar um **registro de configuracao por modulo** (`MODULE_DASHBOARD_CONFIG`) que mapeia cada `module.code` para suas propriedades visuais e de navegacao. Isso mantem a flexibilidade de adicionar modulos novos com uma unica entrada no registro.

```text
effectiveUserModules (do hook)
        |
        v
MODULE_DASHBOARD_CONFIG[module.code]
        |
        +---> Module Health Card (score, severidades, etc.)
        +---> Infrastructure item (icone, label, contagem)
```

## Alteracoes tecnicas

### 1. Novo arquivo: `src/config/moduleDashboardConfig.ts`

Registro central que mapeia `module.code` para configuracao do dashboard:

```ts
export interface ModuleDashboardConfig {
  // Identificador usado como chave no stats (ex: "firewall", "m365")
  statsKey: string;
  // Rota principal do modulo
  path: string;
  // Label do ativo no card infraestrutura (ex: "Firewalls", "Tenants M365")
  infraLabel: string;
  // Ocultar contadores de severidade no health card?
  hideSeverities?: boolean;
}

export const MODULE_DASHBOARD_CONFIG: Record<string, ModuleDashboardConfig> = {
  scope_firewall: {
    statsKey: 'firewall',
    path: '/scope-firewall/dashboard',
    infraLabel: 'Firewalls',
  },
  scope_m365: {
    statsKey: 'm365',
    path: '/scope-m365/posture',
    infraLabel: 'Tenants M365',
    hideSeverities: true,
  },
  scope_external_domain: {
    statsKey: 'externalDomain',
    path: '/scope-external-domain/domains',
    infraLabel: 'Domínios',
  },
};
```

### 2. Ajuste: `src/hooks/useDashboardStats.ts`

Mudar o tipo de retorno de `DashboardStats` para usar um `Record` dinamico em vez de campos fixos:

```ts
// Antes:
export interface DashboardStats {
  firewall: ModuleHealth;
  m365: ModuleHealth;
  externalDomain: ModuleHealth;
  agentsOnline: number;
  agentsTotal: number;
}

// Depois:
export interface DashboardStats {
  modules: Record<string, ModuleHealth>; // chave = statsKey
  agentsOnline: number;
  agentsTotal: number;
}
```

A logica interna de fetch continua a mesma (cada modulo tem queries especificas), mas os resultados sao armazenados no `Record`:

```ts
setStats({
  modules: {
    firewall: fwHealth,
    m365: m365Health,
    externalDomain: extHealth,
  },
  agentsOnline,
  agentsTotal,
});
```

### 3. Ajuste: `src/pages/GeneralDashboardPage.tsx`

**Substituir a lista hardcoded de cards** por uma iteracao sobre `effectiveUserModules`, filtrando apenas modulos que possuem entrada no `MODULE_DASHBOARD_CONFIG`.

**Resolucao de icone**: O campo `module.icon` vem do banco como string (ex: `"Shield"`). Criar um mapeamento simples de string para componente Lucide:

```ts
import { Shield, Cloud, Layers, Globe, Server, Network } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Shield, Cloud, Layers, Globe, Server, Network,
};
```

**Resolucao de cor**: O campo `module.color` vem como `"text-orange-500"`. Derivar as variantes de bg e border a partir dele:

```ts
// "text-orange-500" -> "bg-orange-500/10", "border-l-orange-500"
const colorBase = module.color?.replace('text-', '') || 'primary';
const iconBg = `bg-${colorBase}/10`;
const borderColor = `border-l-${colorBase}`;
```

**Construcao dinamica dos cards**:

```ts
const moduleCards = effectiveUserModules
  .filter(um => um.permission !== 'none')
  .map(um => {
    const config = MODULE_DASHBOARD_CONFIG[um.module.code];
    if (!config) return null; // modulo sem config de dashboard
    const Icon = ICON_MAP[um.module.icon || ''] || Shield;
    const colorBase = um.module.color?.replace('text-', '') || 'primary';
    return {
      key: um.module.code,
      title: um.module.name,
      icon: Icon,
      iconColor: um.module.color || 'text-primary',
      iconBg: `bg-${colorBase}/10`,
      borderColor: `border-l-${colorBase}`,
      health: stats?.modules[config.statsKey] || emptyHealth,
      moduleCode: um.module.code,
      path: config.path,
      hideSeverities: config.hideSeverities,
    };
  })
  .filter(Boolean);
```

**Card Infraestrutura** -- os itens do grid tambem serao dinamicos, iterando sobre os mesmos modulos:

```tsx
{moduleCards.map(card => (
  <div key={card.key} className="flex flex-col items-center gap-0.5 p-3 rounded-lg bg-muted/30">
    <div className="flex items-center gap-1.5">
      <card.icon className={cn('w-4 h-4', card.iconColor)} />
      <span className="text-base text-muted-foreground">{config.infraLabel}</span>
    </div>
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Total</span>
    <span className="text-lg font-bold text-foreground">
      {stats?.modules[config.statsKey]?.assetCount ?? 0}
    </span>
  </div>
))}
{/* Agents - sempre presente */}
<div className="flex flex-col items-center ...">
  <Monitor /> Agents / Online / {online}/{total}
</div>
```

**Tratamento especial do M365 (CVEs)**: A logica do `extraInfo` com CVEs sera mantida como caso especial para `scope_m365`, verificando o `module.code` durante a iteracao.

### 4. Ajuste de `lastOverallScan`

Atualmente calcula a partir de 3 campos fixos. Passara a iterar sobre `stats.modules`:

```ts
const lastOverallScan = stats
  ? Object.values(stats.modules)
      .map(m => m.lastAnalysisDate)
      .filter(Boolean)
      .sort()
      .pop() || null
  : null;
```

## Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `src/config/moduleDashboardConfig.ts` | **Novo** - registro de config por modulo |
| `src/hooks/useDashboardStats.ts` | Retorno com `modules: Record<string, ModuleHealth>` |
| `src/pages/GeneralDashboardPage.tsx` | Cards e infra dinamicos baseados em `effectiveUserModules` + config |

## O que nao muda

- A logica de fetch de stats por modulo (queries especificas por tabela) permanece inalterada
- O card de Agents continua fixo (nao e um modulo)
- O seletor de workspace para super roles continua funcionando normalmente
- O comportamento de preview mode nao e afetado
