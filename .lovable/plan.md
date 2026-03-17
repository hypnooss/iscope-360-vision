
Objetivo: parar de “interpretar” o efeito e reconstruir o hero do Maze como uma réplica técnica, baseada na estrutura real que consegui inspecionar em `mazehq.com`.

Diagnóstico direto:
- Não, “mesmo código” não garante o mesmo resultado se faltarem partes do sistema: assets, bundles compilados, CSS, viewport, DPR, versão do Three, camera setup, easing/scroll timing e geometria/base data.
- Hoje o nosso `NetworkAnimation.tsx` ainda é uma recriação própria. Mesmo com uniforms parecidos, ele não é o pipeline original do Maze.
- Pela inspeção do HTML do Maze, o hero real não é só “um globo”:
  - existe um container gráfico fixo `.s-gfx.js-gfx`
  - um `<canvas data-engine="three.js ...">` gigante, fixo pela página
  - o hero usa `data-gfx="blob"`
  - há hotspots DOM sobrepostos (`.js-hotspot`)
  - a continuidade do scroll depende da integração entre canvas + seções + triggers de scroll
- O “outro efeito” não parece ser um segundo componente isolado; ele faz parte do mesmo sistema gráfico global do canvas, controlado pelo scroll ao longo da página.

Plano de implementação:
1. Substituir a arquitetura atual do hero
   - Remover a lógica “esfera + flat sand inventado” como base principal.
   - Reestruturar para um sistema gráfico único, fixo na página, igual ao padrão do Maze: canvas global + camadas DOM por cima.

2. Recriar a composição do Maze, não só o shader
   - Separar em:
     - `MazeGfxCanvas` para o render WebGL
     - camada de hotspots/labels HTML
     - controlador de scroll/progress da home
   - Fazer o canvas existir ao longo da página inteira, e não apenas como um fundo visual genérico.

3. Refazer o globo com pipeline equivalente ao Maze
   - Alinhar:
     - distribuição de partículas
     - rotação
     - camera/framing
     - point sizing
     - alpha/falloff
     - gradiente cyan-magenta
     - halo atmosférico
   - Parar de ajustar valores “no olho” e portar a lógica do efeito como um sistema fechado.

4. Refazer o morph/efeito de scroll como parte do mesmo canvas
   - O estado de scroll vai dirigir a transição do gráfico principal, em vez de um `mix` improvisado.
   - O efeito inferior será tratado como um estado do mesmo render, sincronizado com os gatilhos das seções.

5. Alinhar layout da página ao comportamento do Maze
   - Revisar `src/pages/Index.tsx` para o canvas fixo atravessar a página inteira.
   - Garantir stacking, transparências e zonas de leitura para que o gráfico continue visível quando o usuário desce.

6. Só depois fazer micro-ajustes
   - Com a arquitetura correta, ajustar detalhes finos:
     - timing
     - offsets
     - intensidade
     - visibilidade dos hotspots
     - transição entre hero e story sections

O que eu já consegui confirmar do Maze:
- O gráfico principal fica em um container fixo `.s-gfx.js-gfx`
- O hero usa `data-gfx="blob"`
- Há canvas Three.js persistente
- Há vários elementos DOM “hotspot” posicionados sobre o canvas
- Há uma narrativa de scroll conectando hero e seções seguintes

O que falta para copiar “exatamente o mesmo código”:
- O HTML público mostra a estrutura, mas não entrega automaticamente a lógica fonte original de animação em formato legível.
- Para ficar o mais fiel possível ao código real do Maze, o ideal é extrair do console/network:
  - URLs dos bundles JS carregados
  - nomes/URLs de assets gráficos usados pelo canvas
  - possíveis arquivos de shader/model/texture
  - valores de uniforms/estado se estiverem expostos em runtime
  - regras CSS relevantes do container `.s-gfx`, canvas e hotspots

Se eu for implementar isso na próxima etapa, a abordagem será:
- tratar o Maze como “sistema gráfico completo”
- não reaproveitar a lógica atual como base
- reconstruir o hero inteiro para seguir a estrutura real observada no site

Detalhes técnicos:
```text
Maze observado
┌──────────────────────────────────────────────┐
│ .s-gfx.js-gfx                               │
│  ├─ múltiplos .js-hotspot (DOM overlay)     │
│  └─ canvas three.js fixo/global             │
└──────────────────────────────────────────────┘
                ↑ sincronizado com scroll
┌──────────────────────────────────────────────┐
│ hero section data-gfx="blob"                │
│ story/progress sections                     │
│ transições visuais conectadas               │
└──────────────────────────────────────────────┘

Projeto atual
┌──────────────────────────────────────────────┐
│ NetworkAnimation.tsx                         │
│  └─ esfera/shader custom próprio             │
└──────────────────────────────────────────────┘
                ↑
          recriação parcial
```

Conclusão:
- Você está certo em cobrar cópia fiel.
- O problema é que, até agora, a implementação ficou “inspirada no Maze”, não “copiada como sistema”.
- O plano correto é reconstruir a arquitetura inteira do efeito com base na estrutura real do Maze, e usar qualquer dado extra de console/network para aproximar o código do original o máximo possível.
