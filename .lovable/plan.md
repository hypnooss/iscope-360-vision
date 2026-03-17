

## Plano: Animação sutil no terreno de partículas

O terreno já tem ondulação vertical via `sin/cos` no shader (linhas 38-39). Vou adicionar **movimento horizontal lento** (drift) para que as partículas pareçam fluir como uma corrente, além de intensificar a ondulação existente.

### Alterações no vertex shader (`src/components/NetworkAnimation.tsx`)

No bloco do terreno (linhas 37-39), adicionar drift em X e Z:

```glsl
vec3 terrainPos = aPlanePos;
// Slow horizontal drift based on seed
terrainPos.x += sin(uTime * 0.15 + aSeed * 6.28) * 0.12;
terrainPos.z += cos(uTime * 0.1 + aSeed * 4.0) * 0.08;
// Existing wave animation (slightly stronger)
terrainPos.y += sin(uTime * 0.3 + aPlanePos.x * 0.5) * 0.12;
terrainPos.y += cos(uTime * 0.2 + aPlanePos.z * 0.4) * 0.08;
```

Isso dá um efeito de "corrente fluindo" — partículas oscilam lateralmente de forma orgânica, cada uma com fase diferente via `aSeed`.

### Arquivo alterado
- `src/components/NetworkAnimation.tsx` — 4 linhas no vertex shader

