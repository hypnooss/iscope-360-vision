
# Plano: Corrigir Parsing de Dados do Agent M365

## Problema Identificado

Os dados do Agent estão sendo salvos corretamente na tabela `task_step_results`, mas estão em formato de **string JSON** em vez de objetos JavaScript. A função `processM365AgentInsights` espera arrays/objetos, não strings.

### Evidência

Dados salvos no banco:
```json
{
    "exo_mailbox_forwarding": {
        "data": "[{\"DisplayName\":\"Camila Favero\",\"PrimarySmtpAddress\":...}]",
        "success": true
    }
}
```

O campo `data` é uma **string** (começa com aspas), não um array (que começaria com `[`).

### Código afetado (linha 156-158 de `agent-task-result/index.ts`)
```typescript
if (rawData['exo_mailbox_forwarding']) {
    const data = extractStepData(rawData['exo_mailbox_forwarding']);
    if (Array.isArray(data)) {  // ← Falha! data é uma string
```

## Causa Raiz

O Agent Python retorna o output do PowerShell como string JSON (`| ConvertTo-Json`), e essa string está sendo salva diretamente sem parsing adicional.

## Solução

Atualizar a função `extractStepData` no `agent-task-result/index.ts` para fazer parse de strings JSON automaticamente. Isso garante compatibilidade com ambos os formatos (string JSON ou objeto nativo).

### Código Atual
```typescript
function extractStepData(stepResult: unknown): unknown {
  if (!stepResult) return null;
  
  if (typeof stepResult === 'object') {
    const obj = stepResult as Record<string, unknown>;
    if ('data' in obj && obj.data !== undefined) return obj.data;
    if ('results' in obj && obj.results !== undefined) return obj.results;
    if ('value' in obj && obj.value !== undefined) return obj.value;
  }
  
  return stepResult;
}
```

### Código Corrigido
```typescript
function extractStepData(stepResult: unknown): unknown {
  if (!stepResult) return null;
  
  if (typeof stepResult === 'object') {
    const obj = stepResult as Record<string, unknown>;
    let extracted: unknown = null;
    
    // Extract from common wrapper keys
    if ('data' in obj && obj.data !== undefined) {
      extracted = obj.data;
    } else if ('results' in obj && obj.results !== undefined) {
      extracted = obj.results;
    } else if ('value' in obj && obj.value !== undefined) {
      extracted = obj.value;
    } else {
      extracted = stepResult;
    }
    
    // Parse JSON strings (PowerShell outputs JSON as string)
    if (typeof extracted === 'string') {
      try {
        const parsed = JSON.parse(extracted);
        return parsed;
      } catch {
        // Not valid JSON, return as-is
        return extracted;
      }
    }
    
    return extracted;
  }
  
  // Handle top-level string (might be JSON)
  if (typeof stepResult === 'string') {
    try {
      return JSON.parse(stepResult);
    } catch {
      return stepResult;
    }
  }
  
  return stepResult;
}
```

## Impacto

Esta correção permite que:
1. O Agent Python continue retornando dados como string JSON (sem modificações)
2. A Edge Function faz o parse automaticamente
3. Os insights M365 são gerados corretamente
4. A tela de Exchange Online exibe os dados coletados

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-task-result/index.ts` | Atualizar função `extractStepData` para fazer parse de strings JSON |

## Fluxo Corrigido

```text
Agent PowerShell → JSON string → task_step_results
                                        ↓
agent-task-result → extractStepData() → JSON.parse()
                                        ↓
                processM365AgentInsights() → Array de insights
                                        ↓
                m365_posture_history.agent_insights → 7+ insights
                                        ↓
                    ExchangeOnlinePage → Exibe insights ✓
```

## Validação

Após a correção:
- `[processM365AgentInsights] Generated 7 insights from agent data` (ou mais)
- A página Exchange Online exibirá:
  - 7 mailboxes com encaminhamento
  - 1 regra de transporte ativa
  - Políticas anti-phishing configuradas
  - Status DKIM por domínio
