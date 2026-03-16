

## Correções: Globo descentralizado + Areia dispersa demais

### Problema 1: Globo não centralizado
O canvas ocupa `fixed inset-0` (tela inteira), mas a câmera está em `z=800` com FOV 50 e o globo tem `scale = min(w,h) * 0.38`. Em telas largas (ex: 1920px publicado vs 1362px preview), a proporção muda e o globo pode ficar deslocado verticalmente ou parecer menor/maior do que o esperado. O globo em si está na origem (0,0,0), então o problema provavelmente é que o container `fixed inset-0` está sendo afetado pelo Header ou outro elemento de layout, ou a proporção do aspect ratio faz o globo parecer mais alto.

**Correção**: Ajustar a câmera e posição do globo para se manter visualmente centrado na metade superior da tela (hero area), não no centro absoluto do viewport. Vamos adicionar um leve offset Y negativo na posição do globo para centralizar na área do hero.

### Problema 2: Areia dispersa demais no estado final
As flat positions usam um spread de `6.0 x 3.0` em unidades normalizadas, e o scale no estado areia é `currentSphereRadius * 1.8`. Combinados, as partículas ficam espalhadas demais — os pontos ficam muito distantes uns dos outros, perdendo a densidade visual de "areia".

**Correção**: 
- Reduzir o spread das flat positions de `6.0 x 3.0` para `4.0 x 2.0`
- Reduzir o multiplicador de scale no estado areia de `1.8` para `1.4`
- Isso vai concentrar mais as partículas no estado final, criando uma camada de areia mais densa e visualmente coesa

### Mudanças

**`src/components/NetworkAnimation.tsx`**:
1. **Flat positions** (linhas 272-274): reduzir spread X de 6.0→4.0, Z de 3.0→2.0
2. **Sand scale** (linha 365): reduzir multiplicador de 1.8→1.4
3. **Posição Y do globo**: manter centrado — se necessário, ajustar `camera.position.y` ou a posição dos `points` para garantir centralização visual no hero

