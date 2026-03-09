

# Exchange Analyzer — Nova Página

## Objetivo

Criar a página **Exchange Analyzer** no menu Microsoft 365, seguindo o layout do **Firewall Analyzer** (`AnalyzerDashboardV2Page`). A página consolida dados já existentes nas telas M365 Analyzer e Exchange Online.

## Estrutura da Página

A página seguirá a mesma hierarquia visual do Firewall Analyzer:

1. **Header**: Título "Exchange Analyzer", subtítulo, seletores de Workspace (super roles) e Tenant
2. **Linha de última coleta**: Badge com data/hora da última análise
3. **Linha de execução**: Card de progresso quando análise está em andamento (usa `useExchangeOnlineInsights.triggerAnalysis`)
4. **Stats Cards**: 4 cards com métricas resumidas do Exchange (Total Mailboxes, Forwarding Habilitado, Auto-Reply Externo, Sem Login 30d) — dados do `useExchangeDashboard`
5. **Panorama por Categoria**: Grid de cards por categoria de risco do Exchange (`email_exchange`, `threats_activity`, `pim_governance`) — dados do `useExchangeOnlineInsights`, com Sheet lateral ao clicar
6. **Mapa de Ataques**: Card com `AttackMap` baseado em dados de segurança do Exchange (phishing/malware por país, se disponível nos insights)
7. **Insights de Segurança**: Cards dos insights Exchange filtrados por severidade, com Sheet lateral de detalhes — reutilizando o padrão do `SecurityInsightCards` adaptado para Exchange

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/m365/ExchangeAnalyzerPage.tsx` | **Criar** | Página principal seguindo layout do AnalyzerDashboardV2Page |
| `src/components/m365/exchange/ExchangeAnalyzerStatsCards.tsx` | **Criar** | 4 stats cards com métricas do Exchange dashboard |
| `src/components/m365/exchange/ExchangeAnalyzerCategoryGrid.tsx` | **Criar** | Grid de categorias Exchange com contadores e severidade |
| `src/components/m365/exchange/ExchangeAnalyzerCategorySheet.tsx` | **Criar** | Sheet lateral 50vw para detalhes por categoria |
| `src/components/m365/exchange/ExchangeSecurityInsightCards.tsx` | **Criar** | Cards de insights de segurança Exchange com Sheet de detalhes |
| `src/App.tsx` | **Modificar** | Adicionar rota `/scope-m365/exchange-analyzer` |
| `src/components/layout/AppLayout.tsx` | **Modificar** | Adicionar item "Exchange Analyzer" no menu M365 |

## Fontes de Dados

- **Stats operacionais** (mailboxes, tráfego): `useExchangeDashboard` (já existente)
- **Insights de segurança** (postura, regras, configuração): `useExchangeOnlineInsights` (já existente)
- **Trigger de análise**: `useExchangeOnlineInsights.triggerAnalysis` (já existente)
- **Workspace selector**: `useWorkspaceSelector` (já existente)
- **Tenant selector**: `useM365TenantSelector` (já existente)

## Detalhes Técnicos

- O Workspace selector aparece apenas para `super_admin` e `super_suporte` (mesmo padrão do Firewall Analyzer)
- A troca de Workspace filtra os tenants disponíveis
- O Mapa de Ataques usa os dados de `security` do Exchange dashboard (phishing/malware por origem geográfica, quando disponível nos insights)
- Se não houver dados geográficos, o mapa mostra estado vazio com mensagem
- Os insights usam o mesmo padrão de Sheet lateral (50vw) do Firewall Analyzer
- Sem alterações no banco de dados — tudo usa dados já coletados

