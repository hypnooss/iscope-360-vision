

## Plan: Reestruturar M365 Analyzer — IMPLEMENTADO ✅

O M365 Analyzer foi reestruturado de 7 para 12 categorias de análise, adicionando cobertura completa de Entra ID (identidade, MFA, Conditional Access) e Auditoria/Compliance.

### Categorias implementadas
1. **security_risk** — Sign-ins alto risco, falhas MFA, impossible travel, contas bloqueadas
2. **identity_access** — Novos usuários, sem MFA, service accounts, app registrations
3. **conditional_access** — Políticas desabilitadas, report-only, exclusões
4. **exchange_health** — Service health, falhas de entrega, shared mailboxes sem owner
5. **audit_compliance** — Admin audit, delegações, mailbox audit, e-discovery
6-12. Categorias existentes mantidas (phishing, mailbox, behavioral, compromise, rules, exfiltration, operational)

### Arquivos alterados
- `src/types/m365AnalyzerInsights.ts` — 5 novas categorias + métricas expandidas
- `src/hooks/useM365AnalyzerData.ts` — parseMetrics atualizado
- `supabase/functions/trigger-m365-analyzer/index.ts` — payload com 12 módulos
- `supabase/functions/m365-analyzer/index.ts` — 5 novos módulos de análise + Graph API enriquecimento
- `src/pages/m365/M365AnalyzerDashboardPage.tsx` — Resumo executivo + métricas novas + ícones
