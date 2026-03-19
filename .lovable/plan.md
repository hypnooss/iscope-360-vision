

## Plano: Trocar gráfico de barras do Step 02 por diagrama Sankey/Alluvial

### O que muda
Substituir o componente `RiskChart` (barras horizontais) por um diagrama Sankey/Alluvial SVG que mostra os fluxos de severidade (Critical, High, Medium, Low) à esquerda fluindo para "Exploitable" e "Not Exploitable" à direita — exatamente como no print 2.

### Implementação

**Arquivo:** `src/components/landing/SteppedShowcase.tsx`

Reescrever a função `RiskChart` (linhas 108-197) como um componente SVG customizado:

- **Layout**: SVG com 4 nós à esquerda (Critical → Low, com cores atuais) e 2 nós à direita (Exploitable 10%, Not Exploitable 90%)
- **Fluxos**: Paths curvos (cubic bezier) conectando cada severidade aos dois destinos, com cores matching a severidade e opacidade reduzida (~0.4)
- **Barras laterais**: Retângulos coloridos nas bordas esquerda e direita representando proporções
- **Labels**: Nome + valor numérico em cada nó (mesmos dados atuais: 89,186 / 100,455 / 149,156 / 380,431)
- **Texto direita**: "Exploitable 10%" e "Not Exploitable 90%" rotacionados verticalmente
- **Animação**: `motion.path` com `pathLength` animado de 0→1 ao entrar em view, staggered por severidade
- **Fundo**: Mantém o `glass-container` wrapper atual com mesma lógica de opacity

### Dados (mantidos)
```
Critical:  89,186  → ~8,420 exploitable
High:     100,455  → ~4,210 exploitable  
Medium:   149,156  → ~1,890 exploitable
Low:      380,431  → ~320 exploitable
```

### Sem dependências extras
SVG puro + framer-motion (já presente). Sem biblioteca de Sankey.

