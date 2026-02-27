

## Recomendacoes de Melhoria com Base na API do FortiOS 7.4

Apos cruzar os **376 endpoints** documentados na API do FortiOS 7.4 com os **23 endpoints de Compliance** e **9 endpoints do Analyzer** atualmente coletados, identifico as seguintes oportunidades organizadas por impacto.

---

### A. COMPLIANCE — Novas Regras (requer novos steps no blueprint `agent`)

| # | Categoria | Regra Sugerida | Endpoint API | Justificativa |
|---|-----------|---------------|--------------|---------------|
| 1 | Seguranca | Certificados SSL Expirados | `/api/v2/monitor/system/available-certificates` | Detectar certificados do appliance expirados ou proximos de expirar |
| 2 | Seguranca | Security Rating do FortiGuard | `/api/v2/monitor/system/security-rating` | O FortiGate ja calcula um security score interno — podemos comparar com o nosso |
| 3 | Licenciamento | Status FortiAnalyzer | `/api/v2/monitor/license/fortianalyzer-status` | Verificar se FortiAnalyzer esta conectado e funcional |
| 4 | Rede | Tabela ARP Anomala | `/api/v2/monitor/network/arp` | Detectar excesso de entradas ARP (indicador de ARP spoofing) |
| 5 | Rede | Resolucao DNS Funcional | `/api/v2/monitor/network/dns/latency` | Verificar latencia DNS elevada que pode indicar problemas de resolucao |
| 6 | VPN | Tuneis IPsec Down | `/api/v2/monitor/vpn/ipsec` | Compliance: todos os tuneis configurados devem estar UP |
| 7 | VPN | Sessoes SSL-VPN Ativas | `/api/v2/monitor/vpn/ssl` | Visibilidade de usuarios conectados e deteccao de sessoes anomalas |
| 8 | Sistema | FortiGuard Desatualizado | `/api/v2/monitor/system/fortiguard/server-info` | Verificar se as definicoes AV/IPS estao atualizadas |
| 9 | Autenticacao | Usuarios Autenticados Ativos | `/api/v2/monitor/user/firewall` | Detectar contas autenticadas sem atividade (orphan sessions) |
| 10 | UTM | Estatisticas de Antivirus | `/api/v2/monitor/utm/antivirus/stats` | Verificar se o modulo AV esta ativo e processando trafego |
| 11 | Backup | Backup Config Existente | `/api/v2/monitor/system/config-revision` | Verificar se existem revisoes de configuracao salvas recentemente |
| 12 | Rede | SD-WAN Health Check | `/api/v2/monitor/virtual-wan/health-check` | Verificar status dos health-checks SD-WAN |
| 13 | Sistema | Performance e Recursos | `/api/v2/monitor/system/performance/status` | Detectar CPU/Memoria acima de thresholds criticos |
| 14 | Logging | Espaco em Disco de Logs | `/api/v2/monitor/log/current-disk-usage` | Alertar quando disco de logs esta quase cheio |

### B. FIREWALL ANALYZER — Novos Dados para o Dashboard (requer novos steps no blueprint `hybrid`)

| # | Widget / Insight | Endpoint API | O que agrega |
|---|-----------------|--------------|--------------|
| 1 | Sessoes Ativas | `/api/v2/monitor/firewall/session` | Total de sessoes ativas, top consumidores — indicador de carga |
| 2 | Mapa de Politicas Utilizadas | `/api/v2/monitor/firewall/policy` (com hit_count) | Identificar regras nunca utilizadas (shadow rules) — insight de higiene |
| 3 | Status VPN em Tempo Real | `/api/v2/monitor/vpn/ipsec` + `/api/v2/monitor/vpn/ssl` | Painel de status de tuneis e usuarios SSL-VPN |
| 4 | Bandwidth por Interface | `/api/v2/monitor/system/traffic-history/interface` | Grafico de utilizacao de banda por interface ao longo do tempo |
| 5 | Top Aplicacoes Bloqueadas | (ja coleta `appctrl_blocked`) | Ja existe coleta, mas podemos enriquecer com `/api/v2/monitor/utm/app-lookup` para nomes |
| 6 | URLs Maliciosas Detectadas | `/api/v2/monitor/webfilter/malicious-urls` | Contagem e estatisticas de URLs maliciosas pelo WebFilter |
| 7 | Status IPS Engine | `/api/v2/monitor/ips/session/performance` | Metricas de performance do engine IPS |
| 8 | Admins Conectados | `/api/v2/monitor/system/current-admins` | Visibilidade de quem esta logado no appliance em tempo real |
| 9 | Routing Table | `/api/v2/monitor/router/ipv4` | Snapshot da tabela de rotas para deteccao de mudancas |
| 10 | Botnet Domains Stats | `/api/v2/monitor/system/botnet-domains/stat` | Deteccoes de comunicacao com botnets |

### C. IMPLEMENTACAO

Todas as melhorias acima sao **100% data-driven** — nao exigem alteracoes de codigo no frontend ou no agente. O pipeline seria:

1. **Blueprint `agent` (Compliance)**: Adicionar novos steps `http_request` com os endpoints da coluna "Endpoint API" da secao A
2. **Blueprint `hybrid` (Analyzer)**: Adicionar novos steps com os endpoints da secao B
3. **Compliance Rules**: Criar novas regras em `compliance_rules` com `evaluation_logic` JSONB para avaliar os dados coletados
4. **Edge Function `firewall-analyzer`**: Adicionar modulos de processamento para os novos dados (sessoes, politicas, VPN status, bandwidth)
5. **Frontend**: Novos widgets no dashboard do Analyzer para os dados da secao B (cards de sessoes, grafico de bandwidth, painel VPN)

### D. PRIORIZACAO SUGERIDA

**Fase 1 — Alto impacto, baixo esforco (so blueprint + rules):**
- Certificados SSL expirados (A1)
- Tuneis IPsec Down (A6)
- FortiGuard desatualizado (A8)
- Performance/Recursos (A13)
- Security Rating (A2)

**Fase 2 — Analyzer enhancements (blueprint + edge function + UI):**
- Shadow rules / politicas nao utilizadas (B2)
- Sessoes ativas (B1)
- Bandwidth por interface (B4)
- Botnet detection (B10)

**Fase 3 — Complementar:**
- Demais regras de compliance (A3-A5, A9-A12, A14)
- Demais widgets do analyzer (B5-B9)

