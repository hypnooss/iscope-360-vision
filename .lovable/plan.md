

# Plano: Aumentar Padding do ScoreGauge

## Diagnóstico

O código já foi atualizado com `p-3` (12px), mas a sombra ainda pode estar sendo cortada porque:

1. O `drop-shadow` com blur de 10px pode se estender mais do que esperado devido à intensidade da cor
2. Pode haver overflow no container pai (card) que está cortando a sombra

## Solução Proposta

Aumentar o padding de `p-3` (12px) para `p-4` (16px) e verificar se o container pai não tem `overflow: hidden`.

### Alteração 1: Aumentar padding

**Arquivo:** `src/components/ScoreGauge.tsx`

**Linha 49 - Atual:**
```tsx
<div className="relative inline-flex items-center justify-center p-3">
```

**Linha 49 - Proposto:**
```tsx
<div className="relative inline-flex items-center justify-center p-4">
```

### Alteração 2: Verificar se o container pai tem overflow

Precisamos verificar onde o `ScoreGauge` é usado e garantir que o container pai não tenha `overflow: hidden` aplicado. Provavelmente está em um `Card` no Dashboard.

## Passos

1. Aumentar padding de `p-3` para `p-4` no `ScoreGauge.tsx`
2. Verificar e ajustar o componente pai (possivelmente no `Dashboard.tsx`) se necessário

## Resultado Esperado

Sombra/glow visível em 360° sem cortes em nenhum dos lados

