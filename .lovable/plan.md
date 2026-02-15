
# Ordenacao Multi-Criterio dos Cards do Attack Surface Analyzer

## Objetivo

Alterar a ordenacao padrao ("Maior Risco") para usar tres criterios em cascata:

1. **Severidade maxima das CVEs** -- cards com CVEs CRITICAL vem primeiro, depois HIGH, MEDIUM, LOW
2. **Quantidade de servicos** -- em caso de empate no criterio anterior, quem tem mais servicos vem primeiro
3. **Quantidade de portas** -- em caso de empate nos dois criterios anteriores, quem tem mais portas vem primeiro

Resultado: cards com risco LOW, 0 servicos e 0 portas aparecem por ultimo.

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

#### 1. Criar funcao auxiliar `maxCVESeverityRank`

Retorna um valor numerico para a severidade mais alta encontrada nas CVEs de um asset:
- CRITICAL = 4, HIGH = 3, MEDIUM = 2, LOW = 1, sem CVEs = 0

#### 2. Atualizar o sort do modo `risk`

Substituir o sort simples `b.riskScore - a.riskScore` por um sort multi-criterio:

```typescript
case 'risk':
  return sorted.sort((a, b) => {
    // 1. Severidade maxima das CVEs
    const sevDiff = maxCVESeverityRank(b) - maxCVESeverityRank(a);
    if (sevDiff !== 0) return sevDiff;
    // 2. Quantidade de servicos
    const svcDiff = (b.services.length + b.webServices.length) - (a.services.length + a.webServices.length);
    if (svcDiff !== 0) return svcDiff;
    // 3. Quantidade de portas
    return b.ports.length - a.ports.length;
  });
```

#### 3. Atualizar tambem o sort padrao em `buildAssets`

A funcao `buildAssets` (linha 436) que faz o sort inicial tambem sera atualizada para usar a mesma logica multi-criterio, garantindo consistencia mesmo antes de qualquer interacao do usuario com o seletor de ordenacao.

### Resumo

| Arquivo | Mudanca |
|---------|---------|
| `AttackSurfaceAnalyzerPage.tsx` | Adicionar `maxCVESeverityRank`, atualizar sort em `filteredAssets` (modo risk) e em `buildAssets` |
