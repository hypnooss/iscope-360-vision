

## Problema: Falta de ondulações de terreno (dunas) no estado sand

### Análise das imagens
- **MazeHQ (referência)**: Tem ondulações de terreno visíveis — dunas suaves no eixo Y que criam "cordilheiras" horizontais. A câmera inclinada torna essas elevações visíveis como linhas de relevo.
- **Estado atual**: As partículas estão espalhadas num plano completamente plano e aleatório, sem nenhuma estrutura de terreno. O noise atual (`0.003` no Y) é imperceptível.

### Causa raiz
Quando removemos o zig-zag do Y para corrigir as "montanhas", fomos longe demais — agora não há **nenhum** relevo. O MazeHQ **usa** deslocamento Y, mas com ondas **largas e suaves** (baixa frequência, baixa amplitude), não os senos de alta frequência que criaram as montanhas antes.

### Solução — `src/components/NetworkAnimation.tsx`

**1. Restaurar ondulações suaves no eixo Y no shader** (linha 174):
Adicionar senos de **baixa frequência** (ondas largas) com amplitude moderada para criar dunas visíveis:
```glsl
float dune = sin(aFlatPosition.x * 3.0 + uTime * 0.5) * 0.035
           + sin(aFlatPosition.x * 1.5 + aFlatPosition.z * 2.0 - uTime * 0.3) * 0.025;
vec3 flatPos = aFlatPosition + vec3(flatNoiseX * 0.015, dune + flatNoise * 0.003, 0.0);
```

Frequências baixas (`1.5`, `3.0`) criam ondas largas em vez de listras apertadas. A segunda onda combina X e Z para que as dunas não sejam perfeitamente paralelas — criando o efeito orgânico do MazeHQ.

**2. Nenhuma outra mudança** — globo, câmera, scale, tamanhos permanecem iguais.

