
Objetivo: corrigir de verdade o glass para que os cards fora do `SteppedShowcase` voltem a mostrar o background, sem “maquiar” com troca de cor.

Diagnóstico do código atual:
- O problema estrutural continua em `src/pages/Index.tsx`: o `NetworkAnimation` ainda está em um layer separado e fixo:
  ```tsx
  <div className="fixed inset-0 z-0 pointer-events-none">
    <NetworkAnimation />
  </div>
  ```
- Ou seja: a correção arquitetural aprovada não foi realmente aplicada.
- Os cards das seções normais já usam `.feature-card` com transparência e `backdrop-filter`; por isso o bug não é “falta de CSS no card”.
- O `SteppedShowcase` parece funcionar porque os cards dele estão blurando elementos DOM do próprio showcase, não o background global da landing.

O que vou implementar:
1. Reestruturar a landing em um único sistema de camadas
- Em `src/pages/Index.tsx`, criar um wrapper da página para a landing inteira.
- Mover o fundo visual para dentro desse wrapper, no mesmo subtree do conteúdo.
- Trocar o fundo global fixo por uma camada persistente da própria landing, usando:
  - uma base visual contínua
  - o `NetworkAnimation`
  - conteúdo acima dela

2. Fazer o fundo da landing ser realmente “blurável”
- Não deixar o efeito depender só do canvas WebGL isolado.
- Adicionar uma camada base de background dentro do wrapper (gradientes/textura sutil da própria landing) atrás do conteúdo e junto do `NetworkAnimation`.
- Assim, todos os cards terão backdrop real para blurar em qualquer seção, não apenas no showcase.

3. Ajustar a hierarquia de z-index sem hacks frágeis
- Background da landing: camada de fundo
- Conteúdo das seções: camada acima
- Sem voltar para soluções como `z-[-1]` no showcase ou fundos globais fora da árvore visual correta.
- O `SteppedShowcase` continua visível e integrado ao mesmo sistema.

4. Limpar os efeitos colaterais das tentativas anteriores
- Remover dependências de soluções provisórias que não atacam a causa.
- Manter `Reveal` apenas como animação de entrada, sem usá-lo como “conserto” do glass.
- Preservar o visual original dos cards, sem novo escurecimento cosmético.

Arquivos que vou alterar:
- `src/pages/Index.tsx`
- `src/index.css`
- `src/components/landing/SteppedShowcase.tsx` somente se precisar alinhar a nova hierarquia visual

Resultado esperado:
- Cards de Problem, Real Problem, How it Works, Features, Testimonials e Blog ficam translúcidos de forma consistente.
- O `SteppedShowcase` continua aparecendo normalmente.
- O glass volta a depender de uma arquitetura correta de fundo, e não de coincidência visual local.

Resumo técnico:
```text
Hoje:
[canvas WebGL fixed fora da árvore visual da landing]
[sections/cards tentando blurar um fundo isolado]

Depois:
[landing wrapper]
 ├─ [background base + NetworkAnimation]
 └─ [sections/cards]

Assim o backdrop-filter dos cards passa a enxergar um fundo real e contínuo.
```
