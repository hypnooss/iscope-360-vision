

## Corrigir perspectiva da areia — preencher metade inferior da tela

### O que está errado
O plano de partículas está pequeno e flutuando. O MazeHQ mostra um **chão** que preenche toda a metade inferior da viewport, com partículas densas na parte de baixo e ficando mais esparsas/menores conforme vão "para longe" (horizonte no meio da tela).

### Causa raiz
- `flatX = 1.6` com scale `1.8 * radius` ≈ 936px — não cobre os 1362px de largura
- `rotation.x = 0.15 rad` é raso demais — o plano aparece quase de lado em vez de como um chão
- O offset Y não posiciona o plano para preencher a metade de baixo

### Solução — `src/components/NetworkAnimation.tsx`

**1. Expandir spread das partículas** (linhas 278-279):
- `flatX`: `1.6` → `3.0` (cobrir largura total + margem)
- `flatZ`: `4.0` → `3.0` (profundidade adequada)

**2. Aumentar inclinação para parecer um chão** (linha 374):
- `rotation.x`: `0.15` → `0.55` rad (~31°) — inclinação suficiente para parecer chão visto de cima, não montanha

**3. Reposicionar para preencher metade inferior** (linha 377):
- `position.y`: `-0.65` → `-0.35` — menos offset para centralizar o horizonte no meio da tela

**4. Aumentar scale** (linha 380):
- `sandScale`: `1.8` → `2.5` — garantir que o plano cubra toda a largura da viewport

**5. Ajustar camera Z durante morph** — mover câmera mais perto no estado sand para aumentar perspectiva:
- Interpolar `camera.position.z` de `800` para `600` durante morph

A combinação de scale maior + rotation maior + câmera mais perto cria o efeito de "chão infinito" que o MazeHQ usa.

