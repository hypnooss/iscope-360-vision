

# Insights de Segurança vs Compliance — Análise e Proposta

## Como funciona hoje

O hook `useFirewallSecurityInsights` gera **8 insights heurísticos** baseados puramente nos **dados de tráfego** do snapshot (métricas numéricas e rankings). São regras estáticas no frontend:

| # | Insight | Trigger |
|---|---------|---------|
| 1 | VPN Exposta a Ataques Globais | vpnFailures > 100 + > 5 países |
| 2 | Alta Taxa de Falhas Admin | > 50% falhas + > 20 tentativas |
| 3 | Comunicação Botnet | botnetDetections > 0 |
| 4 | Port Scans | IP com > 10 portas testadas |
| 5 | Anomalias de Tráfego | anomalyEvents > 20 |
| 6 | Taxa de Bloqueio Elevada | > 70% bloqueado + > 1000 eventos |
| 7 | Sessões Persistentes | activeSessions > 1000 |
| 8 | Tráfego Saída Bloqueado | outboundBlocked > 100 |

## O que o Compliance cobre (36 regras FortiGate)

Categorias: HA, Firmware, Autenticação, Backup, Certificados, Rede, VPN, Licenciamento, Logging, UTM, Segurança, Interfaces, Performance.

## Gap: o que NÃO está correlacionado

Os insights atuais **não cruzam dados do Compliance**. Exemplos de correlações valiosas que poderiam ser feitas:

| Regra Compliance (fail) | Evidência no Analyzer | Insight possível |
|---|---|---|
| `utm-001` IPS desabilitado | `ipsEvents = 0` mas tráfego inbound alto | "IPS desabilitado com tráfego inbound ativo — ataques podem estar passando sem detecção" |
| `utm-004` Web Filter off | `webFilterBlocked = 0` + saída alta | "Sem filtragem web ativa — usuários acessando internet sem controle" |
| `utm-007` App Control off | `appControlBlocked = 0` | "Sem controle de aplicações — shadow IT não monitorado" |
| `utm-009` Antivírus off | botnet/malware no tráfego | "Antivírus de gateway desabilitado com detecções de botnet ativas" |
| `int-001/002/003` Interfaces expostas | authFailures de IPs externos | "Interface admin exposta na WAN — evidenciado por tentativas externas" |
| `inb-001/002/003` RDP/SMB exposto | inbound allowed em portas 3389/445 | "Portas críticas (RDP/SMB) abertas com tráfego ativo" |
| `net-003` Regras Any-Any | alto tráfego permitido sem filtragem | "Políticas permissivas — tráfego passando sem inspeção UTM" |
| `sec-002` 2FA desabilitado | auth failures altas | "Autenticação sem MFA — amplifica risco de brute force" |
| `vpn-001/003` Crypto fraca | VPN ativa com falhas | "VPN usando criptografia fraca com conexões ativas" |

## Proposta: Insights Correlacionados (Compliance ↔ Analyzer)

### Abordagem

Criar uma nova camada de insights que **cruza o último resultado de compliance** do firewall com os dados do analyzer, gerando insights contextuais tipo:

> "⚠️ O IPS está **desabilitado** neste firewall (regra utm-001 em falha), porém detectamos **2.340 conexões inbound** neste período. Sem IPS, ataques de exploração podem estar passando sem detecção."

### Implementação técnica

1. **Novo hook** `useComplianceCorrelatedInsights(snapshot, firewallId)` — busca o último `analysis_history` do firewall e cruza os checks que falharam com as métricas do snapshot

2. **Dados necessários** — já existem no sistema:
   - `analysis_history.report_data` contém os checks por categoria com status pass/fail
   - `AnalyzerSnapshot.metrics` contém os dados de tráfego
   - Basta buscar o último compliance report e cruzar

3. **Regras de correlação** — mapa estático no frontend definindo: "se regra X falhou E métrica Y > threshold → gerar insight com severidade Z"

4. **UI** — Exibir como uma seção separada nos Insights de Segurança, com badge "Correlação Compliance" para distinguir dos insights puramente baseados em tráfego

### Arquivos a criar/editar

- `src/hooks/useComplianceCorrelatedInsights.ts` — novo hook com as regras de correlação
- `src/types/firewallSecurityInsights.ts` — adicionar tipo `source: 'traffic' | 'compliance_correlation'`
- `src/components/firewall/SecurityInsightCards.tsx` — combinar ambas as fontes de insights
- `src/hooks/useFirewallSecurityInsights.ts` — sem alteração (mantém os 8 existentes)

### Exemplo de regra de correlação

```text
{
  complianceCode: 'utm-001',         // IPS desabilitado
  metricCondition: metrics => metrics.inboundAllowed > 50,
  severity: 'critical',
  title: 'IPS Desabilitado com Tráfego Inbound Ativo',
  what: 'O IPS está desabilitado mas há {inboundAllowed} conexões 
         inbound ativas neste período.',
  why: 'Sem IPS, exploits e ataques conhecidos passam sem inspeção.',
  bestPractice: ['Ativar IPS em todas as políticas inbound', ...],
  businessImpact: 'Vulnerabilidades conhecidas podem ser exploradas...'
}
```

Seriam ~10-12 regras de correlação cobrindo as combinações mais críticas das 36 regras de compliance com evidências visíveis no tráfego.

