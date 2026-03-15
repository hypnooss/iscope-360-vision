

## Filosofia de Correlação Compliance ↔ Analyzer: Enriquecimento dos Insights de Segurança

### Conceito Central (salvo como diretriz de produto)

> **Compliance diz "isso está errado". Analyzer mostra "o porquê está errado".**
>
> Insights de segurança nos Analyzers devem evidenciar os **efeitos operacionais reais** de configurações incorretas detectadas no Compliance. Não basta detectar eventos isolados — o valor está na correlação: uma Conditional Access Policy ausente (Compliance) + logins de países incomuns (Analyzer) = narrativa completa de risco.

### Estado Atual

Os três Analyzers geram insights independentes, sem referenciar as falhas de compliance:

| Analyzer | Edge Function | Insights Atuais |
|---|---|---|
| **Entra ID** | `entra-id-security-insights` | SI-001 a SI-009: Logins suspeitos, MFA ausente, logins de países incomuns, brute force, role changes — tudo **sem contexto de compliance** |
| **Exchange** | `exchange-online-insights` | EXO-001 a EXO-005: Forward externo, regras de delete, auto-reply — **sem correlação** com políticas de DLP ou anti-spam do compliance |
| **Colaboração** | `collaboration-dashboard` | Teams públicos, guests, SharePoint inativo — **insights genéricos sem referência a compliance** |

### Plano de Enriquecimento

A abordagem é **buscar os resultados de compliance do tenant** (tabela `m365_posture_history`) dentro de cada edge function de insights e usar as falhas encontradas para:
1. **Enriquecer a descrição** dos insights existentes com o contexto de compliance
2. **Gerar novos insights correlacionados** quando há evidência operacional de uma falha de compliance
3. **Adicionar metadados** (`complianceCode`, `complianceStatus`) para drill-down

#### Alterações por Analyzer

**1. Entra ID Analyzer (`entra-id-security-insights`)**

| Correlação | Compliance Rule | Insight Enriquecido |
|---|---|---|
| Logins de países incomuns + Sem CA de localização | `AUT-010/011` (Risk-based CA) | "Logins de X países detectados — **não há Conditional Access restringindo origem geográfica**" |
| MFA ausente + Compliance MFA falho | `AUT-001/002` (MFA enforcement) | "X usuários sem MFA — **a política de MFA obrigatório não está ativa no Compliance**" |
| Brute force + Sem bloqueio de conta | `AUT-003` (Lockout policy) | "Tentativas de brute force detectadas — **não há política de bloqueio de conta configurada**" |
| Admins sem MFA + Break glass sem proteção | `ADM-007` (Break glass) | "X admins sem MFA — **incluindo contas Break Glass sem proteção**" |

**2. Exchange Analyzer (`exchange-online-insights`)**

| Correlação | Compliance Rule | Insight Enriquecido |
|---|---|---|
| Forward externo ativo + DLP ausente | `EXO-022` (Forward rules) | "Encaminhamento externo ativo — **sem política de DLP para prevenir vazamento**" |
| Spam/phishing alto + Anti-spam fraco | `EXO-*` (Anti-spam policies) | "X e-mails de phishing entregues — **política anti-spam está em modo fraco ou desabilitada**" |
| Auto-reply externo + Sem restrição | Exchange compliance rules | "Auto-reply para externos ativo — **sem política restringindo informações em respostas automáticas**" |

**3. Colaboração Analyzer (`collaboration-dashboard`)**

| Correlação | Compliance Rule | Insight Enriquecido |
|---|---|---|
| Teams com guests + Sem policy de guest | `TMS-*` (Guest policies) | "X teams com convidados externos — **sem política de revisão periódica de guests**" |
| Sites SharePoint inativos + Sem governança | `SPO-*` (SharePoint governance) | "X sites abandonados — **sem política de lifecycle para sites inativos**" |

#### Implementação Técnica

Cada edge function receberá uma etapa adicional no início:

```typescript
// Buscar último resultado de compliance do tenant
const { data: lastCompliance } = await supabase
  .from('m365_posture_history')
  .select('results')
  .eq('tenant_record_id', tenantRecordId)
  .eq('status', 'completed')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

const failedCodes = new Set(
  (lastCompliance?.results || [])
    .filter(r => r.status === 'fail')
    .map(r => r.code)
);
```

Depois, em cada função de análise, o código verifica se o compliance code relacionado está em `failedCodes` e enriquece o insight:

```typescript
// Exemplo: analyzeUnusualLocations
if (failedCodes.has('AUT-010')) {
  insight.description += '\n\n⚠️ Correlação de Compliance: Não existe política de Acesso Condicional baseada em risco de sign-in (AUT-010).';
  insight.metadata = { ...insight.metadata, complianceCode: 'AUT-010', complianceCorrelation: true };
  // Pode elevar severity se a correlação agrava o risco
}
```

#### Alterações no Frontend

- **`IncidentDetailSheet`**: Na aba "Análise", exibir uma seção "Correlação de Compliance" quando `metadata.complianceCorrelation === true`, mostrando o código e link para o item de compliance correspondente
- **Badges nos cards**: Adicionar badge "Correlação Compliance" (ícone Link) quando o insight possui correlação

#### Arquivos Afetados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/entra-id-security-insights/index.ts` | Buscar compliance, enriquecer SI-001 a SI-009 |
| `supabase/functions/exchange-online-insights/index.ts` | Buscar compliance, enriquecer EXO-001 a EXO-005 |
| `supabase/functions/collaboration-dashboard/index.ts` | Buscar compliance, enriquecer insights de Teams/SharePoint |
| `src/components/m365/analyzer/IncidentDetailSheet.tsx` | Seção de correlação compliance |
| `src/components/m365/shared/SecurityInsightCard.tsx` | Badge de correlação compliance |

### Prioridade de Implementação

1. **Entra ID** (maior impacto: logins + MFA + CA)
2. **Exchange** (forward + anti-spam)
3. **Colaboração** (guests + SharePoint)
4. **Frontend** (badges + detail sheet)

