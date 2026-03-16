

## Corrigir angulação da areia — horizonte plano

### Diagnóstico
A imagem mostra que o plano de areia está formando um "morro" no centro (linhas vermelhas em V invertido). O desejado (linhas verdes) é um horizonte quase plano/horizontal, com leve curvatura. O `rotation.x = 0.35 rad` está inclinando o plano demais, fazendo o centro subir e as bordas descerem.

### Solução — `src/components/NetworkAnimation.tsx`

1. **Reduzir rotation.x**: `0.35` → `0.15` rad (~8.5°) — inclinação muito mais sutil, mantendo o plano quase horizontal como um horizonte
2. **Aumentar offset Y**: `-currentSphereRadius * 0.5` → `-currentSphereRadius * 0.65` — empurrar a areia mais para baixo na tela para que o horizonte fique na posição correta (terço superior da área)
3. **Aumentar sand scale**: `1.5` → `1.8` — compensar a menor inclinação com mais spread para manter cobertura horizontal

