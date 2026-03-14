

## Enriquecer Cards de Insights de Segurança

### Problema
Os cards atuais exibem apenas: nome, badge de severidade, e blocos cinza com "Ocorrências" / "Usuários Afetados". Layout pobre comparado aos cards de "Detalhamento da Exposição" do Surface Analyzer (print 2) que mostram múltiplas badges inline coloridas com informações densas.

Além disso, o usuário quer ver também verificações com status OK (insights de severidade `info` ou `low` que representam verificações que passaram).

### Solução

**1. Criar componente compartilhado `SecurityInsightCard`** em `src/components/m365/shared/SecurityInsightCard.tsx`

Card unificado no estilo da print 2 (Surface Analyzer):
- **Linha 1**: Nome do insight (bold) + categoria label (texto menor, muted)
- **Linha 2**: Badges inline coloridas:
  - Badge de severidade (Critical/High/Medium/Low/Info com cores semânticas)
  - Badge de ocorrências (ex: `245 ocorrências`)
  - Badge de usuários afetados (ex: `3 usuários`)
  - Badge de categoria (ex: `Proteção contra Ameaças`)
  - Badge de tendência se disponível no metadata (`trend`)
- **Borda esquerda** colorida por severidade (mantém padrão atual)
- Para insights **OK/Info**: borda verde (`border-l-emerald-500`), ícone `CheckCircle2`, badge verde "OK"

**2. Adicionar suporte a insights "OK"**

- Adicionar `status?: 'fail' | 'pass'` ao tipo `M365AnalyzerInsight`
- Nas Edge Functions, já existem checks condicionais (ex: `if (phishingMessages.length > 50)` gera insight). Adicionar `else` blocks que geram insights com `severity: 'info'` e `status: 'pass'` para checks que passaram (ex: "Anti-Phishing configurado corretamente", "Safe Links habilitado")
- No card, insights com `status: 'pass'` ganham visual verde com ícone de check

**3. Refatorar os 3 componentes** (`ExchangeSecurityInsightCards`, `EntraIdSecurityInsightCards`, `TeamsSecurityInsightCards`) para usar o novo `SecurityInsightCard` compartilhado, eliminando duplicação.

**4. Layout do grid**: Manter grid 2 colunas. Insights de falha aparecem primeiro (ordenados por severidade), seguidos dos insights OK.

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/types/m365AnalyzerInsights.ts` | +campo `status?: 'fail' \| 'pass'` |
| `src/components/m365/shared/SecurityInsightCard.tsx` | Novo componente compartilhado com layout rico |
| `src/components/m365/exchange/ExchangeSecurityInsightCards.tsx` | Usar `SecurityInsightCard` |
| `src/components/m365/entra-id/EntraIdSecurityInsightCards.tsx` | Idem |
| `src/components/m365/teams/TeamsSecurityInsightCards.tsx` | Idem |
| `supabase/functions/m365-analyzer/index.ts` | Adicionar insights de status "pass" |
| `supabase/functions/entra-id-security-insights/index.ts` | Idem |
| `supabase/functions/collaboration-dashboard/index.ts` | Idem |

