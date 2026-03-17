

## Plano: Transição Globo → Terreno de Partículas (scroll-driven)

### O que é esse efeito

No MazeHQ, conforme o usuário scrolla, o globo esférico "abre" e se transforma num plano ondulado de partículas — como um terreno/landscape visto de cima em perspectiva. É tudo feito com as **mesmas partículas**, apenas mudando a posição-alvo de cada uma via shader (de esfera para plano).

### Dependemos de algo externo?

**Não.** Já temos tudo: Three.js, os shaders, as 22k partículas. A transição é puramente matemática no vertex shader — um `mix()` entre a posição esférica e uma posição de plano, controlado por um uniform `uMorph` que vai de 0 (globo) a 1 (terreno). Não precisamos de nenhum asset ou arquivo do MazeHQ.

### Implementação

**1. Adicionar atributo `aPlanePos` na geometria** — posição-alvo de cada partícula no plano

Cada partícula recebe uma posição num plano XZ com ondulação de ruído (simplex/sin waves):
```
x = (random - 0.5) * 12    // espalhamento horizontal amplo
y = sin(x*0.8) * cos(z*0.6) * 0.3  // ondulação tipo terreno
z = (random - 0.5) * 8     // profundidade
```

**2. Adicionar uniform `uMorph` ao vertex shader**

```glsl
uniform float uMorph; // 0 = globo, 1 = terreno
attribute vec3 aPlanePos;

void main() {
  // ... existing displaced sphere position ...
  vec3 terrainPos = aPlanePos;
  vec3 finalPos = mix(displaced, terrainPos, uMorph);
  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
  // ...
}
```

**3. Controlar `uMorph` pelo scroll** (no tick loop)

Atualmente o scroll move o globo para cima. Em vez disso, quando `scrollProgress` vai de 0.3→1.0, interpolar `uMorph` de 0→1, e ajustar a câmera/rotação para a vista de perspectiva do terreno.

**4. Ajustes visuais durante morph**
- Rotação Y continua (terreno gira lentamente)
- Rotação X aumenta (~0.6 rad) para dar a vista inclinada/perspectiva
- Câmera pode subir levemente (position.y)
- O halo faz fade out (alpha → 0) durante o morph
- Core suppression e rim glow fazem fade out no fragment shader via `uMorph`

**5. Remover o deslocamento Y atual**

O comportamento atual de mover o globo para cima via `position.y` será substituído pelo morph. O globo fica no centro e se transforma no terreno conforme o scroll.

### Arquivos a alterar

1. **`src/components/NetworkAnimation.tsx`** — toda a lógica: novo atributo `aPlanePos`, uniform `uMorph`, shader morph, scroll logic, camera adjustments

