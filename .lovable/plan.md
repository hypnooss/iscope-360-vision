

## Redesign: Entra ID - Dashboard de Governança de Identidade

### Resumo
Reescrever a página `EntraIdPage.tsx` com layout vertical em 7 seções distintas, usando os dados já disponíveis no hook `useEntraIdDashboard` (sem mudanças no backend). Criar componentes dedicados para as novas seções.

### Arquivos a Criar

**1. `src/components/m365/entra-id/IdentityScoreCard.tsx`**
- Card grande com `ScoreGauge` (já existe) centralizado
- Score calculado client-side a partir dos dados existentes (cobertura MFA, exposição de admins, risco, etc.)
- Barra de progresso horizontal abaixo do gauge
- 4 fatores compostos com mini indicadores: Cobertura MFA, Exposição de Admins, Risco de Identidade, Segurança de Senhas
- Cada fator com badge de status (Bom/Moderado/Crítico) e cor

**2. `src/components/m365/entra-id/IdentityOverviewCards.tsx`**
- Grid 4 colunas com cards: Usuários, Administradores, Convidados, Sincronização
- Cada card: ícone + número grande + subtexto secundário
- Estilo glass-card com glow sutil

**3. `src/components/m365/entra-id/AuthPostureCard.tsx`**
- Card grande com barra de progresso horizontal (MFA coverage %)
- Mostra: usuários com MFA / sem MFA
- Cores condicionais: verde (>80%), amarelo (50-80%), vermelho (<50%)

**4. `src/components/m365/entra-id/IdentityRiskCard.tsx`**
- Card com 3 métricas: riskyUsers, atRisk, compromised
- Barras verticais simples (recharts BarChart) mostrando distribuição
- Cores por nível de risco

**5. `src/components/m365/entra-id/LoginActivityCard.tsx`**
- Barras horizontais comparativas: sucesso, falha, bloqueado
- Seletor de período (visual only -- dados vêm do backend com período fixo de 30d, o seletor fica preparado para futuro)

**6. `src/components/m365/entra-id/GovernanceCards.tsx`**
- Dois cards lado a lado: Alterações de Usuário + Atividade de Senhas
- Estilo M365StatsCard mas com layout dedicado

### Arquivo a Modificar

**`src/pages/m365/EntraIdPage.tsx`** - Reescrever completamente:

```text
┌─────────────────────────────────────────────────┐
│ Breadcrumb                                       │
├─────────────────────────────────────────────────┤
│ SEÇÃO 1: Contexto do Tenant                      │
│ [Tenant selector] [Status] [Atualizar][Exportar] │
│                           [Abrir no Entra ID]    │
├─────────────────────────────────────────────────┤
│ SEÇÃO 2: Score de Segurança de Identidade        │
│ [ScoreGauge]  [4 fatores com indicadores]        │
├─────────────────────────────────────────────────┤
│ SEÇÃO 3: Visão Geral (4 cards horizontais)       │
│ [Usuários][Admins][Convidados][Sincronização]    │
├─────────────────────────────────────────────────┤
│ SEÇÃO 4: Postura de Autenticação (MFA)           │
│ [Barra progresso + números]                      │
├──────────────────────┬──────────────────────────┤
│ SEÇÃO 5: Risco       │ SEÇÃO 6: Login Activity  │
│ [Barras verticais]   │ [Barras horizontais]     │
├──────────────────────┴──────────────────────────┤
│ SEÇÃO 7: Governança (2 cards lado a lado)        │
│ [Alterações Usuário] [Atividade de Senhas]       │
└─────────────────────────────────────────────────┘
```

### Detalhes Técnicos

- **Score calculation** (client-side): média ponderada de 4 fatores derivados dos dados existentes:
  - MFA Coverage: `(mfa.enabled / mfa.total) * 100`
  - Admin Exposure: penalização baseada em `admins.globalAdmins`
  - Identity Risk: penalização baseada em `risks.riskyUsers + risks.compromised`
  - Password Security: baseado em self-service vs resets forçados
- **Nenhuma mudança no hook** `useEntraIdDashboard` nem na edge function
- **Componentes reutilizáveis**: usam `Progress` (ui), `ScoreGauge`, `recharts` (BarChart) já disponíveis
- **Estilo**: `glass-card`, bordas `border-border/50`, glow classes do tema dark existente
- **Seletor de período** na Seção 6: UI-only (state local), prepara para futura integração com parâmetro no backend

### Componentes Existentes Reutilizados
- `ScoreGauge` do `@/components/ScoreGauge`
- `Progress` do `@/components/ui/progress`
- `TenantSelector` do `@/components/m365/posture/TenantSelector`
- `recharts` (BarChart, Bar, ResponsiveContainer)
- Todos os ícones de `lucide-react`

