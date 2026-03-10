

## Reformatar Sheet de Insights do Exchange para o padrão Firewall

### Problema
A Sheet lateral dos insights de segurança do Exchange exibe seções genéricas (Descrição, Detalhes, Recomendação), enquanto o Firewall usa seções estruturadas e mais explicativas: métricas em grid, "O que está acontecendo?", "Por que isso é um risco?", "Boas práticas recomendadas" (lista), "Impacto no negócio".

### Mapeamento de campos

O tipo `M365AnalyzerInsight` possui: `description`, `details`, `recommendation`, `affectedUsers`, `count`, `metadata`. Vou mapear para o layout do Firewall:

| Seção Firewall | Fonte Exchange |
|---|---|
| Grid de métricas (label+valor) | `count` + `affectedUsers.length` + valores numéricos de `metadata` |
| 🎯 O que está acontecendo? | `description` |
| ❓ Por que isso é um risco? | `details` |
| ✅ Boas práticas recomendadas | `recommendation` (split por `. ` ou `\n` para gerar lista) |
| 💼 Impacto no negócio | Extraído de `metadata.businessImpact` se existir, senão derivado do severity |
| 👥 Usuários Afetados | `affectedUsers` (mantido, não existe no Firewall mas faz sentido aqui) |
| 🔎 Evidências | Restante do `metadata` (arrays e valores) |

### Alteração

**Arquivo: `src/components/m365/exchange/ExchangeSecurityInsightCards.tsx`**

Substituir o conteúdo da ScrollArea (linhas 141-216) pelo layout estruturado:

1. **Grid de métricas** (2 colunas, `bg-secondary/30`, font bold lg) — mesmo estilo do Firewall
2. **"O que está acontecendo?"** — usa `description`
3. **"Por que isso é um risco?"** — usa `details`
4. **"Boas práticas recomendadas"** — `recommendation` convertido em lista (split por `. ` ou `; `)
5. **"Impacto no negócio"** — `metadata.businessImpact` ou texto genérico baseado na severidade
6. **"Usuários Afetados"** — lista existente
7. **"Evidências"** — metadata restante (arrays/valores)

Nenhuma alteração de tipo ou backend necessária.

