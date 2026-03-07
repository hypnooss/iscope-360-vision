

## Redesign: Exchange Online - Dashboard Operacional e de Postura de Segurança

### Resumo
Reescrever `ExchangeOnlinePage.tsx` com layout vertical em 6 seções, seguindo o mesmo padrão visual do redesign do Entra ID. Criar componentes dedicados em `src/components/m365/exchange/`. Os dados já disponíveis no hook `useExchangeDashboard` são suficientes — sem mudanças no backend.

### Arquivos a Criar

**1. `src/components/m365/exchange/EmailSecurityScoreCard.tsx`**
- Mesmo padrão visual do `IdentityScoreCard` do Entra ID
- `ScoreGauge` centralizado + barra de progresso
- Score calculado client-side com 4 fatores ponderados:
  - Proteção contra phishing: penaliza proporcionalmente ao volume de phishing vs total de tráfego
  - Detecção de malware: idem
  - Exposição por forwarding: penaliza se `forwardingEnabled > 0`
  - Atividade de mailboxes: penaliza por `notLoggedIn30d` e `overQuota`
- Cada fator com badge Bom/Moderado/Crítico

**2. `src/components/m365/exchange/ExchangeOverviewCards.tsx`**
- Grid 4 colunas: Total Mailboxes, Novas (30d), Sem Login (30d), Próximas do Limite
- Cada card: ícone + número grande + label secundário
- Estilo glass-card com glow

**3. `src/components/m365/exchange/EmailSecurityPostureCard.tsx`**
- Card com barras verticais (recharts `BarChart`) para Spam, Malware, Phishing
- Cores por tipo: amarelo (spam), laranja (malware), vermelho (phishing)
- Substitui o donut chart atual

**4. `src/components/m365/exchange/EmailTrafficCard.tsx`**
- Barras horizontais comparativas: Enviados vs Recebidos vs Total
- Números grandes ao lado de cada barra
- Período "Últimos 30 dias" como label

**5. `src/components/m365/exchange/MailboxHealthCard.tsx`**
- Card com métricas de configuração/exposição: Forwarding habilitado, Auto-reply externo, Mailboxes sem login
- Estilo lista com indicadores coloridos (warning/ok)

### Arquivo a Modificar

**`src/pages/m365/ExchangeOnlinePage.tsx`** - Reescrever completamente com layout:

```text
┌─────────────────────────────────────────────────┐
│ Breadcrumb                                       │
├─────────────────────────────────────────────────┤
│ SEÇÃO 1: Contexto do Tenant                      │
│ [Tenant selector] [Status] [Atualizar][Exportar] │
│                       [Abrir no Exchange Admin]  │
├─────────────────────────────────────────────────┤
│ SEÇÃO 2: Email Security Score                    │
│ [ScoreGauge]  [4 fatores com indicadores]        │
├─────────────────────────────────────────────────┤
│ SEÇÃO 3: Visão Geral (4 cards horizontais)       │
│ [Total][Novas][Sem Login][Próximas Limite]       │
├──────────────────────┬──────────────────────────┤
│ SEÇÃO 4: Segurança   │ SEÇÃO 5: Tráfego        │
│ [Barras verticais]   │ [Barras horizontais]     │
├──────────────────────┴──────────────────────────┤
│ SEÇÃO 6: Configuração e Saúde das Caixas         │
│ [Forwarding] [Auto-reply] [Sem Login]            │
└─────────────────────────────────────────────────┘
```

### Detalhes Técnicos

- **Score**: média ponderada de 4 fatores derivados dos dados do `useExchangeDashboard`:
  - Proteção phishing (30%): `max(0, 100 - (phishing / max(1, totalTraffic)) * 10000)`
  - Detecção malware (25%): similar
  - Exposição forwarding (25%): `forwardingEnabled > 0 ? max(0, 100 - forwardingEnabled * 10) : 100`
  - Atividade mailboxes (20%): `max(0, 100 - (notLoggedIn30d / max(1, total)) * 200)`
- **Sem mudanças** no hook `useExchangeDashboard` nem na edge function
- **Reutiliza**: `ScoreGauge`, `Progress`, `TenantSelector`, `recharts` (BarChart), `Badge`, `Skeleton`
- **Estilo**: `glass-card`, `border-border/50`, `bg-card/80`, glow classes

### Arquivos Totais
- 5 novos componentes em `src/components/m365/exchange/`
- 1 página reescrita: `src/pages/m365/ExchangeOnlinePage.tsx`

