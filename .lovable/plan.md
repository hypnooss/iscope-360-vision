

## Alinhar Sheet de Insights do Exchange com o Firewall

### Problema
A Sheet do Exchange tem estilos extras que não existem no Firewall: backgrounds coloridos nas seções (`bg-muted/50`, `bg-emerald-500/10`, `bg-amber-500/10`), bordas coloridas, e seções extras (Usuários Afetados, Evidências) que adicionam complexidade visual desnecessária.

### Referência: Firewall `InsightDetailSheet` (linhas 166-212)
O Firewall usa um layout limpo e direto:
- Métricas em grid `bg-secondary/30`
- Seções de texto **sem background** (apenas `text-sm` direto)
- "Boas práticas" como lista simples com `•` em `text-primary`, **sem** background verde
- "Impacto no negócio" como `text-sm text-muted-foreground`, **sem** background âmbar

### Alteração

**Arquivo: `src/components/m365/exchange/ExchangeSecurityInsightCards.tsx`**

Reescrever o conteúdo da ScrollArea (linhas 141-282) para replicar **exatamente** o padrão do Firewall:

1. **Métricas** — grid 2 colunas, `bg-secondary/30` (já está correto)
2. **"O que está acontecendo?"** — remover `bg-muted/50 rounded-lg p-3`, usar apenas `<p className="text-sm">`
3. **"Por que isso é um risco?"** — mesmo: remover background, usar `text-sm` direto
4. **"Boas práticas recomendadas:"** — remover `bg-emerald-500/10 border`, usar `<ul className="space-y-1">` com `<span className="text-primary shrink-0">•</span>` (igual Firewall)
5. **"Impacto no negócio:"** — remover `bg-amber-500/10 border`, usar `<p className="text-sm text-muted-foreground">`
6. **Manter** Usuários Afetados e Evidências depois (o Firewall não tem, mas são úteis para Exchange)

Resultado: layout visualmente idêntico ao print do Firewall.

