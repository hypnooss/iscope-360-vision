
## Plano: Corrigir Exibição de "Análise Efetuada" para Regras do Fortigate

### Diagnóstico

A função `getEvaluationDescription()` em `BlueprintFlowVisualization.tsx` espera uma estrutura simples de lógica de avaliação:

```json
{ "field": "...", "operator": "eq", "value": "..." }
```

Porém, as regras do Fortigate usam uma estrutura mais complexa:

```json
{
  "source_key": "system_interface",
  "field_path": "results",
  "conditions": [
    { "contains": "http", "field": "allowaccess", "operator": "any_match", "result": "fail", "where": { "role": "wan" } }
  ],
  "default_result": "pass"
}
```

Como resultado, a função retorna `" eq N/A"` que aparece como "= N/A".

---

### Solução

Atualizar a função `getEvaluationDescription()` para interpretar corretamente ambas estruturas (simples e complexa).

#### Alteração em `src/components/admin/BlueprintFlowVisualization.tsx`

**Antes (linhas 208-240):**
```tsx
function getEvaluationDescription(logic: Record<string, any>): string {
  if (!logic) return 'N/A';
  
  const field = logic.field || logic.path || '';
  const operator = logic.operator || logic.op || 'eq';
  const value = logic.value !== undefined ? JSON.stringify(logic.value) : 'N/A';
  // ... operadores simples
}
```

**Depois:**
```tsx
function getEvaluationDescription(logic: Record<string, any>): string {
  if (!logic || Object.keys(logic).length === 0) return 'N/A';
  
  // Estrutura complexa do Fortigate (com conditions)
  if (logic.source_key && logic.conditions) {
    const sourceKey = logic.source_key.replace(/_/g, ' ');
    const conditions = logic.conditions as Array<Record<string, any>>;
    
    if (conditions.length > 0) {
      const cond = conditions[0];
      const parts: string[] = [];
      
      // Campo principal
      if (cond.field) parts.push(`Campo: ${cond.field}`);
      
      // Operador
      if (cond.operator) {
        const opLabels: Record<string, string> = {
          'any_match': 'qualquer correspondência',
          'not_empty': 'não vazio',
          'equals': 'igual a',
          'not_equals': 'diferente de',
          'count_greater_than': 'quantidade maior que',
          'version_compare': 'comparação de versão',
        };
        parts.push(`Operador: ${opLabels[cond.operator] || cond.operator}`);
      }
      
      // Condição where
      if (cond.where) {
        const whereStr = Object.entries(cond.where)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        parts.push(`Onde: ${whereStr}`);
      }
      
      // Valor buscado
      if (cond.contains) parts.push(`Contém: "${cond.contains}"`);
      if (cond.value !== undefined) parts.push(`Valor: ${cond.value}`);
      if (cond.matches) parts.push(`Matches: ${cond.matches.join(', ')}`);
      
      // Resultado esperado
      const resultLabel = {
        pass: 'aprovado',
        fail: 'reprovado', 
        warn: 'alerta'
      }[cond.result as string] || cond.result;
      parts.push(`Resultado: ${resultLabel}`);
      
      return `[${sourceKey}] ${parts.join(' | ')}`;
    }
    
    return `Fonte: ${sourceKey}`;
  }
  
  // Estrutura simples original (domínio externo)
  const field = logic.field || logic.path || '';
  const operator = logic.operator || logic.op || 'eq';
  const value = logic.value !== undefined ? JSON.stringify(logic.value) : '';
  
  // ... resto da lógica existente
}
```

---

### Resultado Esperado

A seção "ANÁLISE EFETUADA" passará a exibir informações legíveis como:

| Antes | Depois |
|-------|--------|
| `= N/A` | `[system interface] Campo: allowaccess \| Operador: qualquer correspondência \| Onde: role=wan \| Contém: "http" \| Resultado: reprovado` |

Para regras simples (domínio externo), continuará funcionando normalmente.
