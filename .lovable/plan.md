

# Plano: Correção do Recorte da Sombra do ScoreGauge

## Problema Identificado

O efeito `drop-shadow(0 0 10px ...)` aplicado ao círculo de progresso está sendo cortado nos 4 lados porque:

1. O container `div` usa `inline-flex` sem padding
2. O SVG tem dimensões exatas de `size x size` (200x200)
3. A sombra de 10px se estende além dessas dimensões e é cortada pelo overflow do container pai

## Solução

Adicionar padding ao container principal do `ScoreGauge` para acomodar a sombra nos 4 lados.

## Alteração Necessária

**Arquivo:** `src/components/ScoreGauge.tsx`

**Linha 49 - Atual:**
```tsx
<div className="relative inline-flex items-center justify-center">
```

**Linha 49 - Proposto:**
```tsx
<div className="relative inline-flex items-center justify-center p-3">
```

O padding de `p-3` (12px) é suficiente para acomodar o blur de 10px da sombra em todos os lados:
- Superior (top)
- Inferior (bottom)  
- Esquerdo (left)
- Direito (right)

## Resultado Visual

| Antes | Depois |
|-------|--------|
| Sombra cortada nas bordas | Sombra visível completa em 360° |
| Container justo ao SVG | Container com margem para o glow |

## Complexidade

Mínima - Apenas adição de uma classe CSS

