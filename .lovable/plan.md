

## Redesign: Colaboração - Dashboard de Governança de Colaboração

### Resumo
Reescrever `CollaborationPage.tsx` com layout vertical em 6 seções, seguindo o padrão visual dos dashboards Entra ID e Exchange Online. Criar 4 novos componentes dedicados. Sem mudanças no backend nem no hook `useCollaborationDashboard`.

### Dados Disponíveis (do hook)
```
teams: { total, public, private, withGuests, privateChannels, sharedChannels }
sharepoint: { totalSites, activeSites, inactiveSites, externalSharingEnabled, totalLists }
analyzedAt: string
```

### Arquivos a Criar

**1. `src/components/m365/collaboration/CollaborationScoreCard.tsx`**
- Mesmo padrão visual do `IdentityScoreCard` e `EmailSecurityScoreCard`
- `ScoreGauge` + barra de progresso + 4 fatores:
  - Teams Públicas (30%): penaliza pela proporção `public/total`
  - Teams com Convidados (25%): penaliza pela proporção `withGuests/total`
  - Compartilhamento Externo (25%): penaliza por `externalSharingEnabled`
  - Sites Inativos (20%): penaliza pela proporção `inactiveSites/totalSites`

**2. `src/components/m365/collaboration/TeamsOverviewCards.tsx`**
- Grid 4 colunas: Total Teams, Públicas, Privadas, Com Convidados
- Estilo glass-card com ícone + número grande

**3. `src/components/m365/collaboration/TeamsGovernanceCard.tsx`**
- Card com barras horizontais mostrando exposição: Teams públicas, com convidados, canais compartilhados
- Cores indicativas (warning para exposição)

**4. `src/components/m365/collaboration/SharePointCards.tsx`**
- Dois cards lado a lado:
  - Overview: Total sites, Ativos, Inativos (barras horizontais)
  - Governance: Compartilhamento externo habilitado, Sites inativos (indicadores warning/ok)

### Arquivo a Modificar

**`src/pages/m365/CollaborationPage.tsx`** - Reescrever com layout:

```text
┌─────────────────────────────────────────────────┐
│ Breadcrumb                                       │
├─────────────────────────────────────────────────┤
│ SEÇÃO 1: Contexto do Tenant                      │
│ [Tenant selector] [Status] [Atualizar][Exportar] │
│                    [Abrir no M365 Admin]         │
├─────────────────────────────────────────────────┤
│ SEÇÃO 2: Collaboration Security Score            │
│ [ScoreGauge]  [4 fatores com indicadores]        │
├─────────────────────────────────────────────────┤
│ SEÇÃO 3: Teams Overview (4 cards horizontais)    │
│ [Total][Públicas][Privadas][Com Convidados]      │
├─────────────────────────────────────────────────┤
│ SEÇÃO 4: Teams Governance                        │
│ [Barras horizontais de exposição]                │
├──────────────────────┬──────────────────────────┤
│ SEÇÃO 5: SP Overview │ SEÇÃO 6: SP Governance   │
│ [Sites métricas]     │ [Indicadores exposição]  │
└──────────────────────┴──────────────────────────┘
```

### Detalhes Técnicos
- **Score**: média ponderada client-side dos 4 fatores usando dados existentes do hook
- **Sem donut charts** — usa barras horizontais e cards de métricas
- **Reutiliza**: `ScoreGauge`, `Progress`, `Badge`, `Skeleton`, `TenantSelector`
- **Estilo**: `border-border/50 bg-card/80`, glass-card, glow classes do tema dark

