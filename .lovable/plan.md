

## Diagnóstico: Itens N/A inflando o score negativamente

### Problema Confirmado

Você está correto. Itens com status `not_found` (N/A) **estão sendo contabilizados no denominador** do cálculo de score, o que penaliza injustamente categorias inteiras onde o serviço não está licenciado.

O problema ocorre em **4 motores de scoring independentes**, cada um com uma variação diferente do bug:

| Motor | Arquivo | Como trata N/A | Impacto |
|---|---|---|---|
| **M365 Posture** | `m365-security-posture` | `not_found` conta no `totalChecks` usado como `maxPenalty` | Dilui o score (mais checks = menor penalidade % por falha) |
| **M365 Posture (Agent merge)** | `agent-task-result` | `maxPenalty = totalChecks * 4` inclui N/A | Idem |
| **Entra ID Compliance** | `entra-id-compliance` | N/A conta no `totalWeight` mas não ganha `earnedWeight` → **penaliza diretamente** (0 pontos para N/A) |
| **Frontend passRate** | Firewall/External Domain pages | `passRate = pass / total * 100` — N/A não é `pass`, então reduz a taxa | Mostra 0% para categorias 100% N/A |

### Exemplo concreto (Intune)

6 regras Intune, todas `not_found`. No cálculo do `entra-id-compliance`:
- `totalWeight = 6 * weight` (contabiliza)
- `earnedWeight = 0` (N/A não ganha pontos)
- Score da categoria = **0%** ← deveria ser **excluída**

### Solução

Filtrar itens `not_found` de **todos** os cálculos de score, tanto no backend quanto no frontend. Itens N/A devem ser exibidos na UI (para transparência) mas **não devem afetar o score**.

### Alterações

**Backend (3 Edge Functions):**

| Arquivo | Alteração |
|---|---|
| `m365-security-posture/index.ts` | Filtrar `not_found` antes de calcular `totalPenalty` e `categoryBreakdown.score` |
| `agent-task-result/index.ts` | Filtrar `not_found` antes de calcular `maxPenalty` e `recalculatedScore` |
| `entra-id-compliance/index.ts` | No `calculateScore`, fazer `continue` para `status === 'not_found'` (igual já faz para `pending`) |

**Frontend (4 locais com `calculatePassRate`):**

| Arquivo | Alteração |
|---|---|
| `src/pages/firewall/FirewallCompliancePage.tsx` | Excluir checks com `status === 'not_found'` do cálculo |
| `src/pages/external-domain/ExternalDomainCompliancePage.tsx` | Idem |
| `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx` | Idem |
| `src/pages/FirewallAnalysis.tsx` | Idem |
| `src/components/m365/exchange/ExchangeComplianceSection.tsx` | Idem |
| `src/components/pdf/sections/PDFCategorySection.tsx` | Idem |

**Lógica unificada para `calculatePassRate`:**
```typescript
const calculatePassRate = (checks: { status: string }[]): number => {
  const applicable = checks.filter(c => c.status !== 'not_found');
  if (!applicable.length) return -1; // -1 = categoria inteira N/A
  return Math.round((applicable.filter(c => c.status === 'pass').length / applicable.length) * 100);
};
```

Quando `passRate === -1`, a UI exibirá "N/A" em vez de "0%".

**CategorySection / M365CategorySection (UI):**
- Quando `passRate === -1`, renderizar badge "N/A" cinza em vez do percentual
- Manter todos os itens visíveis dentro da categoria para transparência

