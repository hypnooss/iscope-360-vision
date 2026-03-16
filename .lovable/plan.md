

## Ativar movimentação individual das partículas

O problema está no uniform `uSpeed` que controla a velocidade do jitter individual de cada partícula. Atualmente está em `0.00008` — praticamente zero. Combinado com `uTime = elapsed * 0.008`, o valor que chega ao `snoise2d` no shader mal muda, então as partículas parecem estáticas.

A linha do shader responsável é:
```glsl
displaced += vec3(uScale * uDepth * aMove * aSpeed * snoise2d(vec2(aIndex, uTime * uSpeed)));
```

### Mudanças em `src/components/NetworkAnimation.tsx`

| Parâmetro | Valor atual | Novo valor | Efeito |
|-----------|------------|------------|--------|
| `uSpeed` | 0.00008 | 0.15 | Partículas se movem visivelmente na superfície |
| `uDepth` | 0.008 | 0.025 | Aumenta a amplitude do deslocamento individual |
| `uScale` | 0.5 | 1.2 | Escala geral do jitter mais perceptível |

Isso fará cada partícula oscilar individualmente sobre a superfície do globo, além de acompanhar a rotação global. O movimento será orgânico (driven por simplex noise 2D), não linear.

