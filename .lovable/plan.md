

## Resposta direta: NÃO, não é assim que está na MazeHQ

Eu movi a câmera porque ela estava dentro da esfera e nada aparecia. Mas a abordagem inteira está errada comparada com a MazeHQ. Aqui está o que eu descobri ao analisar o HTML real do site deles:

### Como a MazeHQ realmente funciona

A MazeHQ **não** usa um canvas fixo no viewport. O HTML deles mostra:

```text
<canvas data-engine="three.js r182dev" 
        width="1919" height="100000" 
        style="width: 1919px; height: 100000px;">
```

O canvas tem **100.000px de altura** — ocupa a página inteira. O `--app-height: 100000px` no `<html>` confirma isso. Os hotspots (badges de CVE) têm transforms como `translate(-6519px, 22141px)`, ou seja, posições absolutas dentro desse canvas gigante.

**Isso significa que:**
- O globo é renderizado em uma posição Y específica dentro de um canvas enorme
- Conforme o usuário rola, a parte visível do canvas muda naturalmente (como rolar sobre uma imagem gigante)
- A "transição de scroll" não é um uniform de shader — é simplesmente o canvas continuando a renderizar coisas diferentes em posições Y diferentes
- A câmera provavelmente se move verticalmente (ou a cena inteira) sincronizada com o scroll

### O que precisa mudar

1. **Canvas do tamanho da página, não fixed/viewport** — o `NetworkAnimation` deve renderizar num canvas com altura = altura total do conteúdo da página, não `100vh` fixo
2. **Câmera/cena move com scroll** — a câmera Y (ou a posição da cena) acompanha `window.scrollY`, fazendo o globo "sair de vista" naturalmente conforme rola
3. **Sem hack de uniform `uScroll`** — a transição é orgânica: o globo simplesmente fica para trás enquanto o canvas continua
4. **Escala e enquadramento do globo** — recalibrar câmera e escala para que, na posição Y=0 (topo da página), o globo ocupe ~80% do viewport como na referência

### Plano de implementação

**Arquivo: `src/components/NetworkAnimation.tsx`**
- Aceitar prop `pageHeight` (altura total da página)
- Setar o canvas com `height = pageHeight` em vez de `100%`
- Sincronizar a câmera Y com `window.scrollY` no loop de animação (ou usar uma viewport ortográfica que mapeia diretamente)
- Reposicionar o globo no "topo" da cena (Y correspondente ao hero)
- Recalibrar câmera (posição, FOV, escala) para o globo aparecer com o tamanho correto

**Arquivo: `src/pages/Index.tsx`**
- Trocar o container `fixed inset-0` por um container `absolute` com altura total da página
- Passar `pageHeight` para o `NetworkAnimation`
- Medir a altura total da página via ref/ResizeObserver

**Resultado**: O globo aparece grande no hero, e ao rolar a página o canvas simplesmente continua — o globo fica para trás naturalmente, sem hacks de fade/dissolve.

