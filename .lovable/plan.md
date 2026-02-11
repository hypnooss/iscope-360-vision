

# Corrigir Extracao de Severidades - Formato de Dados

## Causa Raiz

O campo `report_data.categories` nos modulos Firewall e Dominio Externo e um **objeto** (dicionario), nao um **array**:

```text
report_data.categories = {
  "Licenciamento": [ {severity: "critical", status: "unknown", ...}, ... ],
  "Seguranca DNS": [ {severity: "high", status: "fail", ...}, ... ],
  ...
}
```

O codigo atual faz `Array.isArray(categories)` que retorna `false` para objetos, fazendo a funcao retornar zeros imediatamente.

## Correcao

### Arquivo: `src/hooks/useDashboardStats.ts`

Alterar a funcao `extractSeveritiesFromReport` (linhas 45-57) para tratar `categories` como objeto ou array:

```text
// Verificar se categories e um objeto (dicionario)
if (categories && typeof categories === 'object' && !Array.isArray(categories)) {
  // Iterar sobre os valores do objeto (cada valor e um array de regras)
  for (const rules of Object.values(categories)) {
    if (Array.isArray(rules)) {
      for (const rule of rules) {
        if (rule.status === 'pass') continue;
        if (rule.severity in counts) counts[rule.severity]++;
      }
    }
  }
  return counts;
}

// Fallback: se for um array (formato antigo), manter logica atual
if (Array.isArray(categories)) {
  for (const cat of categories) {
    const rules = (cat.checks || cat.rules || []);
    for (const rule of rules) {
      if (rule.status === 'pass') continue;
      if (rule.severity in counts) counts[rule.severity]++;
    }
  }
}
```

Essa alteracao suporta ambos os formatos (objeto e array), garantindo compatibilidade com qualquer formato futuro.

## Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useDashboardStats.ts` | Tratar `categories` como objeto (dicionario) alem de array |

