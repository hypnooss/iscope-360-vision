
Objetivo: corrigir de vez o comportamento em que quase todos os cards entram “glass” e depois ficam opacos, mantendo o visual da seção “Tudo que você precisa em um só lugar”.

Diagnóstico real do código:
- O problema não está mais no `Section`.
- Hoje o `Section` já está em `relative z-0`.
- O bloqueio principal continua em `src/pages/Index.tsx` no wrapper:
  - `<main className="flex-1 relative z-10">`
- Esse `main` inteiro cria um stacking context acima do fundo fixo (`NetworkAnimation` em `fixed inset-0 z-0`), então o `backdrop-blur` dos cards não consegue “enxergar” corretamente o canvas do globo.
- A exceção da seção “Tudo que você precisa em um só lugar” acontece porque ela fica imediatamente antes do `SteppedShowcase`, e o showcase foi jogado para `z-[-1]`. Na prática, ele acaba fornecendo textura visual logo atrás dessa área, por isso esses cards parecem continuar com glass mais convincente.

O que implementar:
1. Remover o stacking context desnecessário do wrapper principal
- Alterar `src/pages/Index.tsx`
- Trocar:
  - `main className="flex-1 relative z-10"`
- Para algo sem esse bloqueio global, idealmente:
  - `main className="flex-1 relative"`

2. Revalidar a hierarquia das camadas da landing
- Manter:
  - `NetworkAnimation` como fundo fixo
  - `Section` em `relative z-0`
- Ajustar `SteppedShowcase` só se necessário para continuar atrás do conteúdo normal sem matar o blur.
- Se `z-[-1]` estiver ajudando só “por acidente”, o ideal é redefinir a camada dele de forma controlada em vez de depender disso para dar textura aos cards.

3. Garantir consistência entre sessões
- Confirmar que todos os cards da landing usam apenas:
  - `.feature-card` ou `.glass-container`
- Verificar se não existe algum wrapper específico com fundo sólido/overlay local afetando Problem, Real Problem, How it Works, Testimonials e Blog.

4. Fazer um ajuste fino no showcase se ele voltar a interferir no scroll
- Se ao remover o `z-10` do `main` o `SteppedShowcase` começar a invadir visualmente as próximas seções, ajustar somente o próprio showcase/sticky container, sem recolocar um `z-10` global no `main`.

Arquivos a mexer:
- `src/pages/Index.tsx`
- possivelmente `src/components/landing/SteppedShowcase.tsx` se a sobreposição precisar de refinamento

Resultado esperado:
- Os cards deixam de “parecer glass só na entrada”.
- O `backdrop-blur` continua ativo após a animação.
- O visual fica consistente entre as seções, não apenas na seção anterior ao `SteppedShowcase`.

Detalhe técnico importante:
```text
Estado atual:
NetworkAnimation (fixed z-0)
└─ main (relative z-10)   <- bloqueia o backdrop real
   └─ sections/cards

Estado desejado:
NetworkAnimation (fixed z-0)
└─ main (relative)
   └─ sections z-0
      └─ feature-card com backdrop-blur vendo o fundo real
```
