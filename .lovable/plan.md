

## Plano: Envolver cada gráfico em um card com bordas sutis

### Mudança

Substituir o `<div className="space-y-2">` que envolve cada gráfico (CPU, RAM, cada Disco, cada Rede) por um card com bordas arredondadas e sutis, adicionando padding interno.

### Implementação em `AgentMonitorPanel.tsx`

Trocar cada wrapper de gráfico de:
```tsx
<div className="space-y-2">
```
para:
```tsx
<div className="space-y-2 rounded-xl border border-border/40 bg-card/50 p-4">
```

Locais afetados (todos os wrappers `space-y-2` dentro do grid de charts):
1. **CPU** (linha 436)
2. **RAM** (linha 455)
3. **Disco — partições** (linha 492, dentro do `.map()`)
4. **Disco — legado** (linha 516)
5. **Rede — interfaces** (linha 558, dentro do `.map()`)
6. **Rede — legado** (se existir, verificar linhas seguintes)

| Arquivo | Mudança |
|---------|---------|
| `AgentMonitorPanel.tsx` | ~6 divs: adicionar classes `rounded-xl border border-border/40 bg-card/50 p-4` |

