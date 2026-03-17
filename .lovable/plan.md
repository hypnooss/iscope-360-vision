

## Diagnóstico

O problema é exatamente o que foi sugerido antes: **a câmera está dentro da esfera**. A diferença é que você não vê as partículas de trás porque o shader tem um `frontFade = smoothstep(-0.3, 0.6, sphereNormal.z)` que **elimina partículas do hemisfério traseiro em object space**. Então:

- Partículas da frente (z positivo em object space) → estão atrás da câmera → não aparecem na projeção
- Partículas de trás (z negativo em object space) → estão na frente da câmera → mas o `frontFade` as elimina

Resultado: quase nada aparece, exceto uma faixa no limite da transição (a borda que você vê na direita do screenshot).

**Números**: Esfera com scale `3.8` = raio efetivo 3.8. Câmera em `z = 3.6`. Distância câmera→centro ≈ 3.6 < 3.8 = câmera dentro.

## Correção

No `NetworkAnimation.tsx`, duas mudanças numéricas:

1. **Câmera**: `camera.position.z = 3.6` → `camera.position.z = 7.0` (garante que a câmera fica fora da esfera com folga)
2. **FOV**: `40` → `55` (compensa o afastamento para o globo continuar ocupando ~80% do viewport)

Nenhuma outra mudança necessária. O shader, as partículas e o layout do hero já estão corretos.

