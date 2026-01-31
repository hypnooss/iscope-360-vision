
# Plano: Adicionar Shadow Sutil ao Gauge

## Objetivo

Adicionar um `drop-shadow` menor (2px) no círculo de progresso do gauge para suavizar o serrilhado (aliasing) sem alterar significativamente a percepção da cor.

---

## Alteração

### Arquivo: `src/components/ScoreGauge.tsx`

**Adicionar style na linha 73 (no círculo de progresso):**

De:
```tsx
<circle
  cx={center}
  cy={center}
  r={radius}
  fill="none"
  stroke={getColor()}
  strokeWidth="12"
  strokeLinecap="round"
  strokeDasharray={circumference}
  strokeDashoffset={strokeDashoffset}
  className="transition-all duration-1000 ease-out"
/>
```

Para:
```tsx
<circle
  cx={center}
  cy={center}
  r={radius}
  fill="none"
  stroke={getColor()}
  strokeWidth="12"
  strokeLinecap="round"
  strokeDasharray={circumference}
  strokeDashoffset={strokeDashoffset}
  className="transition-all duration-1000 ease-out"
  style={{
    filter: `drop-shadow(0 0 2px ${getColor()})`,
  }}
/>
```

---

## Resultado

| Antes | Depois |
|-------|--------|
| Sem shadow (bordas serrilhadas) | Shadow sutil de 2px (anti-aliasing) |
| Cor exata do tema | Cor praticamente idêntica (blur mínimo) |

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ScoreGauge.tsx` | Adicionar `filter: drop-shadow(0 0 2px ...)` no círculo de progresso |
