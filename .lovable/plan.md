
Objetivo: parar de “testar no escuro” e corrigir pela causa real, sem mexer só na cor dos cards.

Diagnóstico do que está acontecendo:
- O CSS dos cards já tem transparência e `backdrop-filter`.
- O problema também não é mais apenas `z-index` no `main` ou nas `Section`.
- Hoje, quem está “fornecendo” o visual transparente de fato é o próprio conteúdo do `SteppedShowcase`, porque ele fica logo atrás dos cards dele.
- Nas outras seções, os cards dependem do `backdrop-filter` capturar o `NetworkAnimation`, que está em um layer fixo separado (`fixed inset-0 z-0`).
- Na prática, esse caminho de composição entre cards normais e o canvas WebGL fixo está falhando/inconsistente neste layout. Por isso os cards parecem opacos fora do showcase.

O que vou implementar:
1. Reestruturar o fundo da landing
- Tirar o `NetworkAnimation` de um sibling global fixo do `<main>`.
- Colocar o background visual da landing dentro de um wrapper próprio da página, no mesmo contexto visual do conteúdo que precisa do efeito glass.
- Isso evita depender de um blur “atravessando” camadas/compositing do canvas fixo.

2. Separar fundo visual e conteúdo com uma arquitetura estável
- Criar um wrapper da landing com:
  - camada de background persistente
  - camada de conteúdo
- O conteúdo continua acima visualmente, mas sem recriar a arquitetura quebrada atual.
- O objetivo é que todos os `.feature-card` enxerguem o mesmo fundo real, não só os do showcase.

3. Corrigir o `SteppedShowcase` para não sumir
- Remover a solução frágil de `zIndex: -1` no container inteiro.
- Reposicionar o showcase para continuar atrás das seções seguintes apenas onde necessário, sem desaparecer da página.
- O sticky scroll continua, mas com layering controlado.

4. Reverter ajustes cosméticos indevidos
- Restaurar o glass system para o visual original esperado, sem “escurecer”/alterar a aparência só para mascarar o bug.
- Manter `.feature-card` como padrão, mas sem depender de mudança de cor para fingir transparência.

Arquivos que devem ser alterados:
- `src/pages/Index.tsx`
- `src/components/landing/SteppedShowcase.tsx`
- `src/index.css`

Resultado esperado:
- Os cards de Problem, Real Problem, How it Works, Features, Testimonials e Blog passam a ficar realmente translúcidos.
- O `SteppedShowcase` volta a aparecer normalmente.
- O efeito glass deixa de depender de coincidência de camada e passa a funcionar de forma consistente na landing inteira.

Detalhe técnico:
```text
Hoje:
[NetworkAnimation fixed fora do fluxo]
[main / sections / cards]

Desejado:
[Landing wrapper]
 ├─ [background persistente da landing]
 └─ [sections + cards no mesmo sistema visual]

Assim o glass deixa de depender de blur sobre um canvas fixo “isolado”.
```
