

## Plano: Ajustar ScrollDown e espaçamento entre seções

### Problemas identificados

1. **ScrollDown muito alto** — Atualmente usa `bottom-8` (32px). Precisa ficar mais perto do rodapé da viewport.
2. **Seções invadindo o rodapé** — Cada `Section` tem `py-[120px]`, o que cria padding grande mas o conteúdo das seções seguintes aparece no rodapé da viewport atual. O ScrollDown fixo compete visualmente com o início da próxima seção.
3. **SteppedShowcase (steps 01→02→03)** — O ScrollDown não interage com os sub-passos do showcase. O showcase usa scroll interno (400vh com scroll-driven animations), mas o ScrollDown pula de `features` direto para `testimonials`, ignorando os 3 passos internos.

### Alterações

**1. `src/components/landing/ScrollDown.tsx`** — Aproximar do rodapé
- Mudar `bottom-8` para `bottom-4` (16px) para ficar mais colado ao rodapé da viewport.

**2. `src/pages/Index.tsx`** — Aumentar padding entre seções
- Na função `Section`, aumentar `py-[120px]` para `py-[160px]` para dar mais respiro entre seções e evitar que o conteúdo da próxima seção "invada" o rodapé da seção exibida.

**3. `src/components/landing/SteppedShowcase.tsx`** — Adicionar sub-IDs para os passos
- Adicionar 3 divs com IDs (`showcase-step-1`, `showcase-step-2`, `showcase-step-3`) distribuídos ao longo do container de 400vh, para que o ScrollDown consiga navegar entre os passos.

**4. `src/pages/Index.tsx`** — Atualizar sectionIds
- Trocar `'showcase'` por `'showcase-step-1', 'showcase-step-2', 'showcase-step-3'` na lista de sectionIds do ScrollDown, para que o botão navegue corretamente entre os 3 passos do showcase.

```text
Sequência final:
hero → problem → real-problem → how-it-works → features → 
showcase-step-1 → showcase-step-2 → showcase-step-3 → 
testimonials → blog → cta (oculto)
```

