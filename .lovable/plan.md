

# Redesign Completo do Dashboard Geral - Painel Executivo de Seguranca

## Problema

O dashboard atual tem tres falhas fundamentais:
1. **Score consolidado sem sentido** -- mistura scores de modulos completamente diferentes numa media unica que nao comunica nada acionavel
2. **Layout generico** -- cards de contagem basica (contadores de ativos) sem contexto de saude ou risco, parecem um inventario e nao um painel de seguranca
3. **Falta de hierarquia visual** -- todas as informacoes tem o mesmo peso visual; nada guia o olhar do usuario para o que e critico

## Pesquisa e Inspiracao

Baseado em pesquisa de dashboards de seguranca profissionais (Secureworks Taegis, AT&T USM, Checkpoint Harmony, Tenable MSSP, Balbix) e artigos de UX para cybersecurity (DesignMonks, AufaitUX, CyberSaint), os principios que serao aplicados:

1. **Score por modulo, nunca consolidado** -- cada dominio de seguranca tem seu proprio gauge, permitindo comparacao visual imediata e identificacao do "elo mais fraco"
2. **Hierarquia de 3 niveis**: KPIs criticos no topo > detalhamento por modulo no meio > contexto historico embaixo
3. **Alertas com urgencia visual** -- issues criticos e altos devem "saltar" da tela com cor e posicionamento
4. **Zero ruido** -- mostrar apenas modulos acessiveis, sem cards desabilitados ou com opacity
5. **Cada elemento e acionavel** -- cards de modulo levam ao dashboard do modulo, severidades sao links para filtros

## Layout Final Proposto

```text
+------------------------------------------------------------------+
|  Dashboard                                        Bem-vindo, Nome |
|  Painel executivo de seguranca                                    |
+------------------------------------------------------------------+
|                                                                    |
|  SECAO 1 - Postura de Seguranca por Modulo (hero)                 |
|  +-------------------+ +-------------------+ +-------------------+ |
|  | [ScoreGauge sm]   | | [ScoreGauge sm]   | | [ScoreGauge sm]   | |
|  |    Firewall        | |  Microsoft 365    | |  Dominio Externo  | |
|  |    82 / Bom        | |  64 / Atencao     | |  91 / Excelente   | |
|  |    12 ativos       | |  3 tenants        | |  8 dominios       | |
|  |  C:2 H:5           | |  C:1 H:4          | |  H:1              | |
|  |  Ultimo: 05/02     | |  Ultimo: 04/02    | |  Ultimo: 03/02    | |
|  |   [Acessar ->]     | |   [Acessar ->]    | |   [Acessar ->]    | |
|  +-------------------+ +-------------------+ +-------------------+ |
|                                                                    |
|  SECAO 2 - Resumo Operacional (2 colunas)                         |
|  +---------------------------+ +--------------------------------+ |
|  | Panorama de Riscos        | | Infraestrutura                 | |
|  | [C:3] [H:9] [M:11] [B:8] | | Agents: 5/7 online [*--]      | |
|  | (4 StatCards coloridos)   | | Total Ativos: 23               | |
|  |                           | | Ultimo Scan: ha 2h             | |
|  +---------------------------+ +--------------------------------+ |
|                                                                    |
|  SECAO 3 - Atividade Recente (timeline)                           |
|  +--------------------------------------------------------------+ |
|  | [FW] FortiGate-HQ    | ClienteA  |  82  | 05/02/2026         | |
|  | [M365] Tenant Corp   | ClienteB  |  64  | 04/02/2026         | |
|  | [EXT] example.com    | ClienteA  |  91  | 03/02/2026         | |
|  | ... (ate 10 itens)                                            | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

## Detalhamento das Secoes

### Secao 1 -- Module Health Cards (a mudanca principal)

Cada modulo com acesso renderiza um **card independente** (componente `ModuleHealthCard` inline) contendo:

- **ScoreGauge** (`size="sm"`, 100px) com o score medio mais recente do modulo (media dos scores mais recentes, 1 por recurso)
- **Nome do modulo** com icone
- **Contagem de ativos** (ex: "12 firewalls monitorados")
- **Mini badges de severidade** (somente criticos e altos, em linha, usando badges `status-fail` / `status-warning` do design system)
- **Data da ultima analise** em texto discreto
- **Botao "Acessar"** que navega ao dashboard do modulo
- **Card inteiro clicavel** com hover scale

Grid responsivo: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`. Se o usuario so tem 1 modulo, o card ocupa largura maior. Modulos sem acesso simplesmente nao aparecem (zero cards desabilitados).

Fontes de dados por modulo:
- **Firewall**: Score = media dos `analysis_history.score` mais recentes (1 por `firewall_id`). Severidades do campo `report_data.summary`.
- **M365**: Score = media dos `m365_posture_history.score` mais recentes (1 por `tenant_record_id`). Severidades do campo `summary`.
- **Dominio Externo**: Score = media dos `external_domain_analysis_history.score` mais recentes (1 por `domain_id`). Sem severidades detalhadas (campo nao existe).

### Secao 2 -- Resumo Operacional (dividido em 2 sub-cards)

**Card esquerdo -- "Panorama de Riscos":**
4 StatCards compactos com contagem total cross-module de Critico/Alto/Medio/Baixo. Reutiliza o componente `StatCard` existente com `compact=true`. As contagens sao a soma de todos os modulos.

**Card direito -- "Infraestrutura":**
Card com 3 metricas operacionais:
- **Agents online/total** com indicador visual (circulo verde/amarelo/vermelho)
- **Total de ativos monitorados** (soma de firewalls + tenants + dominios)
- **Ultima analise** (timestamp da analise mais recente entre todos os modulos)

### Secao 3 -- Atividade Recente (mantida e melhorada)

Timeline unificada das ultimas 10 analises (aumentado de 8), com:
- Icone do modulo com cor (ja existente)
- Nome do recurso + nome do cliente
- Badge de score com cor semantica
- Data formatada
- Hover destaque

## Alteracoes Tecnicas

### Arquivo 1: `src/hooks/useDashboardStats.ts` -- Refatorar

Substituir `consolidatedScore: number | null` por scores individuais por modulo:

```typescript
interface ModuleHealth {
  score: number | null;
  assetCount: number;
  lastAnalysisDate: string | null;
  severities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface DashboardStats {
  firewall: ModuleHealth;
  m365: ModuleHealth;
  externalDomain: ModuleHealth;
  agentsOnline: number;
  agentsTotal: number;
  // Severidades cross-module (soma dos 3)
  totalSeverities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  totalAssets: number;
  lastOverallAnalysis: string | null;
  recentActivity: RecentActivity[];
}
```

As queries paralelas existentes serao mantidas (ja sao eficientes), mas a estrutura do retorno muda para separar os dados por modulo. O campo `consolidatedScore` sera removido.

A logica de calculo por modulo:
- Dedup por resource_id (ja feito), guardar score + severidades + data da mais recente por modulo
- `lastAnalysisDate` = data da analise mais recente daquele modulo
- `lastOverallAnalysis` = max entre os 3 `lastAnalysisDate`
- `totalAssets` = firewalls + tenants + dominios

### Arquivo 2: `src/pages/GeneralDashboardPage.tsx` -- Refatorar completamente

Novo layout com 3 secoes:

**Sub-componente `ModuleHealthCard`** (definido inline no arquivo):
```typescript
interface ModuleHealthCardProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  health: ModuleHealth;
  assetLabel: string;
  loading: boolean;
  onAccess: () => void;
}
```

Renderiza ScoreGauge (sm), contagem, badges, data e botao de acesso. Card inteiro clicavel com `hover:scale-[1.02]` e borda lateral colorida (`border-l-4`).

**Sub-componente `InfrastructureCard`** (inline):
Mostra agents, total ativos, e ultima analise com formatacao relativa (usando `date-fns` `formatDistanceToNow`).

A pagina verifica `hasEffectiveModuleAccess` e renderiza apenas os ModuleHealthCards dos modulos disponiveis. A secao 2 sempre aparece (severidades e infra sao globais).

### Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `src/hooks/useDashboardStats.ts` | Refatorar (scores e severidades por modulo) |
| `src/pages/GeneralDashboardPage.tsx` | Reescrever (novo layout com Module Health Cards) |

Nenhuma alteracao no backend, Edge Functions, ou banco de dados.

