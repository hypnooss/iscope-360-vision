

## Melhorar indicador de scroll

### O que muda

Substituir o indicador atual (texto "Scroll" + ChevronDown com bounce) por uma animação mais elegante e visualmente refinada — uma linha vertical com um ponto que desce suavemente, similar ao padrão usado em sites premium (MazeHQ, Linear).

### Implementação

**Arquivo**: `src/pages/Index.tsx` (linhas 145-149)

Substituir o bloco atual por:
- Uma linha vertical fina (`w-[1px]`, ~40px de altura) com cor `muted-foreground/20`
- Um pequeno círculo (`w-1.5 h-1.5`) que se move de cima para baixo dentro da linha usando uma animação CSS customizada
- Texto "SCROLL" menor e mais espaçado, com opacidade reduzida
- Animação suave de descida infinita via `@keyframes` no CSS ou `framer-motion`

O resultado será um indicador minimalista, sem o bounce agressivo do ChevronDown, alinhado com a estética premium da página.

### Arquivos afetados
- `src/pages/Index.tsx` — substituir bloco do scroll indicator
- `src/index.css` — adicionar keyframe `scroll-down` (opcional, pode usar framer-motion inline)

