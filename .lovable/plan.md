

# Tratar Erros de Licenciamento PowerShell como "Nao Aplicavel"

## Contexto

Apos a atualizacao do agent para v1.2.7, a coleta Exchange Online funciona corretamente, mas 3 de 5 tenants reportam status "partial" e "failed" porque nao possuem licenca do Microsoft Defender for Office 365. Os cmdlets `Get-SafeLinksPolicy` e `Get-SafeAttachmentPolicy` retornam "is not recognized as a name of a cmdlet", o que e tratado como erro quando deveria ser "nao aplicavel".

### Impacto atual

| Tenant | Status | Insights | Problema |
|--------|--------|----------|----------|
| IE Madeira | completed | 15/15 | OK (tem Defender) |
| Precisio | completed | 15/15 | OK (tem Defender) |
| BRASILUX | partial | 12/15 | Safe Links + Safe Attachments = failed |
| ESTRELA | partial | 12/15 | Safe Links + Safe Attachments = failed |
| NEXTA | partial | 11/15 | Safe Links + Safe Attachments = failed |

## Solucao em 3 camadas

### Camada 1 - Agent: Novo status `not_applicable`

**Arquivo:** `python-agent/agent/tasks.py`

Quando um comando PowerShell falha com "is not recognized as a name of a cmdlet", tratar como `not_applicable` em vez de `failed`. Isso indica que o modulo nao esta licenciado no tenant.

```
# No unpacker de batch (linhas ~476-479)
if cmd_result.get('success') is False:
    error_text = cmd_result.get('error', '')
    if 'is not recognized as a name of a cmdlet' in error_text:
        step_status = 'not_applicable'
        step_error = f"Cmdlet nao disponivel (licenca ausente): {error_text[:100]}"
        step_data = None
    else:
        step_status = 'failed'
        step_error = error_text
        step_data = None
```

Na determinacao do status final da tarefa (linhas ~308-314), contabilizar `not_applicable` separadamente para que nao marque a tarefa como `partial` ou `failed`:

```
# Contar not_applicable separadamente
steps_na = sum(1 for sr in step_results if sr['status'] == 'not_applicable')
actual_failures = steps_failed - steps_na  # (ajustar contagem)

if actual_failures == len(steps) and steps:
    status = 'failed'
elif actual_failures > 0:
    status = 'partial'
else:
    status = 'completed'  # Mesmo com not_applicable, e "completed"
```

**Arquivo:** `python-agent/agent/version.py`

Manter versao em 1.2.7 (sem bump, apenas correcao de comportamento).

### Camada 2 - Edge Function: Gerar insight `not_found` para dados ausentes

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

Na funcao `processM365AgentInsights`, quando uma regra nao encontra dados no `rawData` (porque o step foi `not_applicable` ou falhou), gerar um insight com status `not_found` em vez de simplesmente ignorar a regra. Isso garante que a contagem de insights seja consistente (15/15 em todos os tenants).

Mudanca na linha 335:

```typescript
// ANTES: Silenciosamente ignora regras sem dados
if (!sourceKey || !rawData[sourceKey]) continue;

// DEPOIS: Gera insight not_found quando dados estao ausentes
if (!sourceKey) continue;
if (!rawData[sourceKey] || rawData[sourceKey] === null) {
  // Check if the step was reported as not_applicable
  const stepStatus = rawData[`_step_status_${sourceKey}`];
  if (stepStatus === 'not_applicable' || stepStatus === 'failed') {
    insights.push({
      id: rule.code,
      category: rule.category as M365RiskCategory,
      product: mapCategoryToProduct(rule.category),
      name: rule.name,
      description: rule.not_found_description || rule.description || rule.name,
      severity: 'info',
      status: 'not_found',
      details: stepStatus === 'not_applicable'
        ? 'Recurso nao licenciado neste tenant'
        : 'Dados nao coletados - verifique logs do agent',
      recommendation: undefined,
      criteria: rule.description || undefined,
      passDescription: rule.pass_description || undefined,
      failDescription: rule.fail_description || undefined,
      notFoundDescription: rule.not_found_description || undefined,
      technicalRisk: rule.technical_risk || undefined,
      businessImpact: rule.business_impact || undefined,
      apiEndpoint: rule.api_endpoint || undefined,
    });
  }
  continue;
}
```

### Camada 3 - Edge Function: Propagar status dos steps no rawData

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

No bloco que reconstroi o `rawData` a partir dos step results (antes de chamar `processM365AgentInsights`), incluir metadados de status dos steps que falharam ou sao `not_applicable`. Isso permite que a Camada 2 saiba o motivo da ausencia.

Na secao de reconstrucao de dados dos steps (~linha 4180-4200), para cada step com status diferente de success, adicionar:

```typescript
rawData[`_step_status_${stepId}`] = stepResult.status; // 'not_applicable' ou 'failed'
```

### Camada 4 - Agent: Reportar step_data para not_applicable

**Arquivo:** `python-agent/agent/tasks.py`

No `_report_step_result`, quando o status for `not_applicable`, enviar o status e a razao para que o backend possa propagar no rawData:

```python
# Ja funciona com o codigo atual, pois _report_step_result envia o status
# O step sera salvo com status='not_applicable' no backend
```

## Arquivos afetados

| Arquivo | Alteracao |
|--------|-----------|
| `python-agent/agent/tasks.py` | Detectar "not recognized as cmdlet" como not_applicable; ajustar contagem de status final |
| `supabase/functions/agent-task-result/index.ts` | Gerar insights not_found para steps ausentes; propagar status dos steps no rawData |

## Resultado esperado

- Tenants sem Defender for Office 365 mostram status "completed" (nao "partial")
- Regras de Safe Links e Safe Attachments aparecem como "Nao Encontrado" (cinza, neutro) na interface
- A contagem de insights e consistente: 15/15 para todos os tenants (em vez de 12/15 ou 11/15)
- Nenhum impacto em tenants que possuem todas as licencas
- O campo `not_found_description` das compliance_rules EXO-007 e EXO-008 fornece a mensagem amigavel

