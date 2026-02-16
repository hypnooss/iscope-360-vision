

# Ocultar ativos sem portas/servicos e adicionar card de resumo

## Problema

Ativos com 0 portas e 0 servicos ocupam espaco na lista sem trazer informacao util, gerando scroll desnecessario.

## Solucao

**Arquivo**: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

### 1. Separar ativos "vazios" dos ativos relevantes

No `useMemo` de `filteredAssets` (linha ~1198), dividir em dois grupos:
- **activeAssets**: ativos com pelo menos 1 porta OU 1 servico (nmap ou web)
- **emptyAssets**: ativos com 0 portas E 0 servicos

A lista principal renderiza apenas `activeAssets`.

### 2. Card de resumo no final da lista

Criar um componente `EmptyAssetsSummary` que aparece apos o ultimo asset card, exibindo:
- Quantidade total de ativos sem portas/servicos
- Lista compacta dos hostnames/IPs agrupados (colapsavel)
- Visual discreto (glass-card, cor neutra) para nao competir com os ativos relevantes
- Icone `CheckCircle2` indicando que esses ativos foram verificados mas nao possuem exposicao detectada

Exemplo visual:
```text
+-------------------------------------------------------+
| [CheckCircle2] 12 ativos sem exposicao detectada       |
|                                                        |
| Nenhuma porta aberta ou servico identificado.          |
| [v] Ver lista                                          |
|   host1.example.com (1.2.3.4)                          |
|   host2.example.com (5.6.7.8)                          |
|   ...                                                  |
+-------------------------------------------------------+
```

### Detalhes tecnicos

- Usar `Collapsible` do Radix para a lista de hostnames
- Os ativos vazios continuam contabilizados nos stat cards de "Ativos Expostos" (total real)
- O filtro de busca se aplica tambem aos ativos vazios (se o usuario buscar um hostname que esta no grupo vazio, ele aparece no card de resumo filtrado)

