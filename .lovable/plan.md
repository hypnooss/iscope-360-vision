

## Transição Globo → "Areia da Praia" (scroll-driven morph)

### Conceito
Ao rolar a página para baixo, as 18.000 partículas do globo esférico se "dissolvem" suavemente para um plano horizontal disperso — como partículas de areia espalhadas — que serve de fundo para as seções seguintes. Exatamente como o MazeHQ faz.

### Abordagem técnica

**1. Novo uniform `uMorph` (0.0 → 1.0)**
- `0.0` = globo esférico (estado atual)
- `1.0` = plano horizontal disperso ("areia")
- Valor controlado pelo scroll position via JavaScript

**2. Posição-alvo "areia" por partícula**
- Pré-calcular um segundo set de posições (`aFlatPosition`) como atributo do buffer
- Distribuir as partículas num plano XZ largo (ex: retângulo ~4x a largura do viewport) com variação Y via noise para criar ondulações suaves
- No vertex shader: `mix(spherePos, flatPos, uMorph)`

**3. Scroll listener no JavaScript**
- Monitorar a posição de scroll da página
- Mapear a faixa de scroll do Hero (ex: 0px a ~windowHeight) para `uMorph` 0→1
- Usar `smoothstep` ou easing para a transição parecer orgânica
- Atualizar `uniforms.uMorph.value` no animation loop

**4. Ajustes complementares durante o morph**
- **Rotação**: interpolar `points.rotation.y` para 0 conforme `uMorph` → 1 (areia não gira)
- **Câmera/escala**: ajustar `points.scale` para cobrir a largura total da tela no estado "areia"
- **Alpha**: manter ou reduzir levemente para o estado disperso
- **Tamanho das partículas**: reduzir `uSize` conforme `uMorph` sobe para partículas menores na "areia"

**5. NetworkAnimation fixa no background**
- O canvas precisa ter `position: fixed` (ou permanecer como background de toda a página) para que a animação continue visível enquanto o conteúdo rola por cima
- Ajustar o componente para aceitar uma prop `scrollProgress` ou ler o scroll internamente

### Mudanças nos arquivos

**`src/components/NetworkAnimation.tsx`**
- Adicionar atributo `aFlatPosition` (posições no plano XZ)
- Adicionar uniform `uMorph` ao shader e ao objeto JS
- No vertex shader: interpolar entre posição esférica e posição plana com `mix()`
- Aceitar prop `scrollProgress` (number 0-1) ou ler `window.scrollY` internamente
- No animation loop: atualizar `uMorph`, interpolar rotação e escala

**`src/pages/Index.tsx`**
- Mover o NetworkAnimation para fora da seção Hero, torná-lo `fixed` no fundo de toda a página
- Adicionar scroll listener que calcula o progresso e passa para o componente (ou o componente lê sozinho)

### Resultado esperado
- No topo da página: globo esférico girando com partículas deslizando
- Ao rolar: partículas se espalham suavemente para um plano horizontal
- Nas seções abaixo: partículas ficam como fundo de "areia" dispersa, com noise animado mantendo o movimento orgânico

