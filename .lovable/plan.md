

## Aba "Proteção contra Ameaças" — Insights Enriquecidos

### Dados disponíveis no `exoMessageTrace`

Cada registro tem: `SenderAddress`, `RecipientAddress`, `Status`, `Subject`, `Size`, `MessageTraceId`. O campo `Status` permite classificar:
- `FilteredAsSpam` → SPAM bloqueado
- `Quarantined` → Quarentena (phishing/malware)
- `Failed` → Falha na entrega (possível malware)
- `Delivered` → Entregue normalmente

Combinando com `threatData` (Graph API) que tem `threatType`, `deliveryAction`, `senderAddress`, `recipientEmailAddress`.

### Insights ricos que serão gerados

O novo módulo `analyzeThreatProtection` no backend vai produzir insights contextuais como:

1. **"Domínio X enviando SPAM massivo"** — Top sender domains com status `FilteredAsSpam`, gerando insight: *"O domínio spammer.com enviou 342 emails de SPAM para sua organização nas últimas 24h"*
2. **"Usuários X, Y, Z são alvos principais de phishing"** — Ranking de recipients que mais recebem phishing/quarentena: *"usuario@empresa.com foi alvo de 47 tentativas de phishing"*
3. **"Malware detectado de domínio X"** — Domínios que enviaram anexos bloqueados pelo malware filter
4. **"Pico de SPAM acima do baseline"** — Se o volume de spam exceder thresholds significativos
5. **"Política X com ação fraca"** — Avaliação das policies (já existe, será movida para esta categoria)

### Alterações

**1. Backend: `supabase/functions/m365-analyzer/index.ts`**

Nova função `analyzeThreatProtection(exoMessageTrace, threatData, exoContentFilter, exoMalwareFilter, exoAntiPhish, exoSafeLinks, exoSafeAttach)`:

- Classifica messageTrace por Status → contadores de spam/phishing/malware/delivered
- Agrupa sender domains por tipo de ameaça → top spam domains, top malware domains
- Agrupa recipient users por tipo de ameaça → top phishing targets, top spam targets
- Gera insights contextuais:
  - `spam_domain_high_volume` — "Domínio {domain} enviou {count} emails de SPAM"
  - `phishing_target_user` — "Usuário {user} recebeu {count} tentativas de phishing"
  - `malware_sender_domain` — "Malware detectado de {domain}: {count} emails bloqueados"
  - `spam_volume_high` — "Volume total de SPAM: {count} emails bloqueados"
  - `quarantine_volume` — "{count} emails em quarentena no período"
  - Policy insights (movidos da função `analyzePhishingThreats` existente)

Métricas retornadas:
```ts
threatProtection: {
  spamBlocked: number;
  phishingDetected: number;
  malwareBlocked: number;
  quarantined: number;
  totalDelivered: number;
  totalFiltered: number;
  topSpamSenderDomains: { domain: string; count: number }[];
  topPhishingTargets: { user: string; count: number }[];
  topMalwareSenders: { domain: string; count: number }[];
  topSpamRecipients: { user: string; count: number }[];
  deliveryBreakdown: { status: string; count: number }[];
  policyStatus: {
    antiSpam: 'enabled' | 'weak' | 'disabled';
    antiPhish: 'enabled' | 'weak' | 'disabled';
    safeLinks: 'enabled' | 'disabled';
    safeAttach: 'enabled' | 'disabled';
    malwareFilter: 'enabled' | 'weak' | 'disabled';
  };
}
```

Chamar o módulo na sequência de análise e adicionar ao `allMetrics`.

**2. Tipos: `src/types/m365AnalyzerInsights.ts`**

- Adicionar `'threat_protection'` ao `M365AnalyzerCategory`, labels e array
- Adicionar `threatProtection` ao `M365AnalyzerMetrics`

**3. Hook: `src/hooks/useM365AnalyzerData.ts`**

- Adicionar parsing do `threatProtection` no `parseMetrics` com defaults seguros

**4. Novo componente: `src/components/m365/analyzer/ThreatProtectionTab.tsx`**

Layout:
- **KPI Cards** (6): Spam Bloqueado, Phishing Detectado, Malware Bloqueado, Quarentena, Total Filtrado, Total Entregue
- **Policy Status Grid** (5 cards): Anti-Spam, Anti-Phish, Safe Links, Safe Attachments, Malware Filter — com badge verde/amarelo/vermelho
- **Rankings lado a lado**:
  - Top Domínios de SPAM (ex: "spammer.com — 342 emails")
  - Top Alvos de Phishing (ex: "cfo@empresa.com — 47 tentativas")
  - Top Fontes de Malware
- **Incident Cards**: Insights da categoria `threat_protection` no mesmo formato visual das outras abas (IncidentCard com severidade)

**5. Dashboard: `src/pages/m365/M365AnalyzerDashboardPage.tsx`**

- Nova aba "Proteção" com ícone `ShieldCheck`
- Badge com total de ameaças (spam+phishing+malware)
- Adicionar `'threat_protection'` ao filtro de categorias

### Arquivos modificados

1. `supabase/functions/m365-analyzer/index.ts` — novo módulo + integração no pipeline
2. `src/types/m365AnalyzerInsights.ts` — nova categoria + métricas
3. `src/hooks/useM365AnalyzerData.ts` — parsing
4. `src/components/m365/analyzer/ThreatProtectionTab.tsx` — componente visual (novo)
5. `src/pages/m365/M365AnalyzerDashboardPage.tsx` — nova aba

