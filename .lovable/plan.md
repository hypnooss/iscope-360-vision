

## Densidade e Zig-Zag da Areia — Recomendações

Ótimo que o formato acertou! Agora temos dois eixos para trabalhar:

---

### 1. Densidade

**Problema**: 18.000 partículas espalhadas em `3.0 x 3.0` resulta em ~2.000 partículas/unidade² — visualmente esparso no estado sand.

**Opções**:
- **A) Aumentar PARTICLE_COUNT** (ex: 18k → 30k): mais partículas = mais denso, mas pode impactar performance em mobile
- **B) Reduzir spread** (3.0 → 2.0 em X e Z): mesmas partículas em área menor = mais denso visualmente, mas menos cobertura lateral
- **C) Combinação**: subir para 25k partículas + reduzir spread para 2.5 — equilíbrio entre densidade e cobertura

**Recomendo C** — 25k partículas com spread 2.5, compensando com o scale que já está em 2.5x.

### 2. Zig-Zag (ondulações de dunas)

**Problema**: As amplitudes atuais (`0.06`, `0.05`, `0.03`) produzem ondulações de ~6% da unidade — quase invisíveis quando escalado.

**Opções**:
- **A) Aumentar amplitudes estáticas** (dobrar para `0.12`, `0.10`, `0.06`): ondulações fixas mais visíveis
- **B) Adicionar zig-zag animado no shader**: usar `uTime` para mover as ondulações lentamente, como dunas de areia se movendo com o vento — muito mais orgânico
- **C) Ambos**: amplitudes maiores + animação sutil

**Recomendo C** — amplitudes maiores para visibilidade + animação lenta no shader (`flatPos.y += sin(aFlatPosition.x * 4.0 + uTime * 0.3) * 0.05`) para dar vida.

---

### Plano de implementação — `src/components/NetworkAnimation.tsx`

1. **PARTICLE_COUNT**: `18000` → `25000`
2. **Spread**: `flatX` e `flatZ` de `3.0` → `2.5`
3. **Amplitudes zig-zag** (JS, posições iniciais): dobrar todas (`0.06→0.12`, `0.05→0.10`, `0.03→0.06`, random `0.015→0.025`)
4. **Zig-zag animado no shader** (vertex shader, linha 172-173): adicionar ondulação temporal ao `flatPos.y`:
   ```glsl
   float zigzag = sin(aFlatPosition.x * 4.0 + uTime * 2.0) * 0.04
                + sin(aFlatPosition.z * 6.0 - uTime * 1.5) * 0.03;
   vec3 flatPos = aFlatPosition + vec3(0.0, flatNoise * 0.008 + zigzag, 0.0);
   ```
5. **Aumentar `uSize`** levemente (`16→18`) para partículas mais visíveis no estado sand

