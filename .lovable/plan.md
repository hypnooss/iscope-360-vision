

## Correção: Remover KPIs de Configuração do Analyzer

O Analyzer é um radar de **incidentes operacionais** (estilo SOC), não de postura/configuração. Dois KPIs atuais são itens de compliance/boas práticas e não pertencem a este módulo:

- **Sem MFA** (`identity.noMfaUsers`) → configuração estática, já coberta pelo módulo Compliance
- **Forwards Ext.** (`rules.externalForwards`) → regra de configuração, já coberta pelo Compliance (EXO-022)

### Alteração

**Arquivo**: `src/components/m365/analyzer/AnalyzerKPIRow.tsx`

Substituir os 2 KPIs removidos por métricas de **incidentes reais**:

| Removido | Substituído por | Fonte |
|---|---|---|
| Sem MFA | Viagem Impossível (`securityRisk.impossibleTravel`) | Evento de login anômalo |
| Forwards Ext. | Alertas Correlacionados (`compromise.correlatedAlerts`) | Incidentes de comprometimento |

O grid passa a ter 6 KPIs puramente de incidentes:
1. Logins de Risco (`highRiskSignIns`)
2. Falhas MFA (`mfaFailures`)
3. **Viagem Impossível** (`impossibleTravel`) — novo
4. **Alertas Correlacionados** (`correlatedAlerts`) — novo
5. Logins Suspeitos (`suspiciousLogins`)
6. Usuários Anômalos (`anomalousUsers`)

Alteração única no array `kpis` dentro de `AnalyzerKPIRow.tsx`, trocando as 2 linhas e ajustando ícones/thresholds.

