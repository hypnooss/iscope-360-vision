

## Reverter apenas a aproximação das partículas

Vou restaurar `uDepth`, `uAmplitude` e `rMul` para os valores anteriores à segunda modificação, mantendo `uSize` em 14.0.

### Mudanças em `src/components/NetworkAnimation.tsx`

| Parâmetro | Valor atual | Valor restaurado |
|-----------|------------|-----------------|
| `uDepth` | 0.002 | 0.008 |
| `uAmplitude` | 0.03 | 0.06 |
| `rMul` (atmosfera) | `1.005 + Math.random() * 0.03` | `1.01 + Math.random() * 0.1` |
| `rMul` (core) | `0.99 + Math.random() * 0.02` | `0.98 + Math.random() * 0.04` |
| `uSize` | 14.0 | **14.0 (mantido)** |

Isso vai manter as partículas grandes mas permitir que se espalhem mais naturalmente ao redor da esfera.

