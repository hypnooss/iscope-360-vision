
# Plano: Padronização de Cores no Relatório

## Resumo das Alterações

1. **Gauge**: Remover o efeito de glow (drop-shadow) para a cor ficar igual ao card
2. **Badges de severidade**: Padronizar as cores entre categorias e itens

---

## 1. Remover Glow do Gauge

### Arquivo: `src/components/ScoreGauge.tsx`

O efeito `drop-shadow` intensifica a percepção da cor. Removendo-o, a cor ficará visualmente igual ao card de informações.

**Alterar linhas 73-76:**

De:
```tsx
className="transition-all duration-1000 ease-out"
style={{
  filter: `drop-shadow(0 0 10px ${getColor()})`,
}}
```

Para:
```tsx
className="transition-all duration-1000 ease-out"
```

---

## 2. Padronizar Cores dos Badges

### Decisão de Cores Padrão

Usaremos as cores do `ExternalDomainCategorySection` como padrão, pois são mais vibrantes e distintas:

| Severidade | Background | Text | 
|------------|------------|------|
| Critical | `bg-red-500/10` ou `bg-red-500/20` | `text-red-500` |
| High | `bg-orange-500/10` ou `bg-orange-500/20` | `text-orange-500` |
| Medium | `bg-yellow-500/10` ou `bg-yellow-500/20` | `text-yellow-500` |
| Low | `bg-blue-400/10` | `text-blue-400` |

### Arquivo: `src/components/ComplianceCard.tsx`

**Alterar linhas 21-28 (severityColorsFail):**

De:
```typescript
const severityColorsFail: Record<string, string> = {
  critical: 'bg-destructive/20 text-destructive',
  high: 'bg-orange-500/20 text-orange-600',
  medium: 'bg-amber-500/20 text-amber-600',
  low: 'bg-muted text-muted-foreground',
  info: 'bg-muted text-muted-foreground',
};
```

Para:
```typescript
const severityColorsFail: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-500',
  high: 'bg-orange-500/20 text-orange-500',
  medium: 'bg-yellow-500/20 text-yellow-500',
  low: 'bg-blue-400/20 text-blue-400',
  info: 'bg-muted text-muted-foreground',
};
```

---

## Comparativo Visual

### Gauge
| Antes | Depois |
|-------|--------|
| Cor com glow intenso (mais brilhante) | Cor sólida igual ao card |

### Badges de Severidade
| Severidade | Antes (Itens) | Depois |
|------------|---------------|--------|
| Critical | Vermelho (destructive) | Vermelho (red-500) ✓ |
| High | Laranja 600 | Laranja 500 ✓ |
| Medium | Âmbar 600 | Amarelo 500 ✓ |
| Low | Cinza | Azul 400 ✓ |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ScoreGauge.tsx` | Remover `filter: drop-shadow(...)` |
| `src/components/ComplianceCard.tsx` | Padronizar cores de severidade |
