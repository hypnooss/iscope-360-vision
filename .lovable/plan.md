

# Ajustes no Exchange Analyzer: Stats Cards e Panorama por Categoria

## Problema

1. **Stats Cards**: Estão mostrando contadores simples (Total, Forwarding, Auto-Reply, Sem Login). Deveriam seguir o padrão do Firewall Analyzer com métricas calculadas (taxas, percentuais).
2. **Panorama por Categoria**: Está usando dados de compliance/insights (severidade de regras). Deveria usar dados operacionais/telemetria do Exchange (como o Firewall usa tráfego, autenticação, IPS).

## Solução

### 1. Stats Cards — Novo layout com métricas calculadas

| Card | Valor principal | Valor secundário | Ícone/Cor |
|------|----------------|------------------|-----------|
| Total de Mailboxes | `mailboxes.total` | `newLast30d` novas 30d | Mail / teal |
| Proteção Phishing | `security.phishing` detecções | taxa vs total inbound | ShieldAlert / red |
| Detecção Malware | `security.malware` detecções | taxa vs total inbound | Bug / amber |
| Exposição Forwarding | `mailboxes.forwardingEnabled` | % do total de mailboxes | Forward / orange |

Cada card seguirá o layout do Firewall (valor grande + valor contextual menor ao lado).

### 2. Panorama por Categoria — Dados operacionais do Exchange

Em vez de categorias de compliance, usaremos os dados do `ExchangeDashboardData` para criar categorias operacionais no estilo do Firewall Analyzer (com barras proporcionais, badges e contadores):

| Categoria | Dados | Barra | Badges |
|-----------|-------|-------|--------|
| Tráfego de Email | `traffic.sent + received` | Bicolor (Enviados/Recebidos) | `X Enviados`, `Y Recebidos` |
| Proteção Anti-Spam | `security.spam` | Severidade | Badge de severidade |
| Detecção Phishing | `security.phishing` | Severidade | Badge de severidade |
| Detecção Malware | `security.malware` | Severidade | Badge de severidade |
| Forwarding Ativo | `mailboxes.forwardingEnabled` | % do total | `X habilitados` |
| Auto-Reply Externo | `mailboxes.autoReplyExternal` | % do total | `X configurados` |
| Mailboxes Inativas | `mailboxes.notLoggedIn30d` | % do total | `X sem login 30d` |
| Caixas Over Quota | `mailboxes.overQuota` | % do total | `X acima da cota` |

Visual: Grid 3 colunas seguindo exatamente o padrão do `AnalyzerCategoryGrid` do Firewall (ícone colorido, nome, contagem, barra proporcional, badges coloridos, ícone de ExternalLink).

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/m365/exchange/ExchangeAnalyzerStatsCards.tsx` | **Reescrever** — novo layout com métricas calculadas |
| `src/components/m365/exchange/ExchangeAnalyzerCategoryGrid.tsx` | **Reescrever** — categorias operacionais baseadas em `ExchangeDashboardData` |
| `src/pages/m365/ExchangeAnalyzerPage.tsx` | **Ajustar** — passar `dashboardData` ao CategoryGrid (em vez de insights) |

Os componentes `ExchangeAnalyzerCategorySheet`, `ExchangeSecurityInsightCards` e a seção de Insights de Segurança permanecem inalterados.

