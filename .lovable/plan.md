

## Efeitos de transição scroll-driven na landing page

### Situação atual
A página já usa framer-motion com `whileInView` e um único variant `fadeUp` (opacity 0→1, y 40px→0) em todas as seções. Funciona, mas é sutil e repetitivo — todos os elementos fazem o mesmo movimento.

### Proposta
Diversificar as animações de entrada por seção, tornando cada uma visualmente distinta. Manter `once: true` para não re-animar ao voltar.

### Novos variants (`src/pages/Index.tsx`)

| Seção | Efeito | Detalhes |
|---|---|---|
| Hero | `fadeUp` + `scale` | Já existe, manter. Adicionar leve scale 0.95→1 no título |
| Problem (números) | `fadeUp` maior | y: 60→0, cards com stagger 0.15 |
| Real Problem | `fadeLeft` / `fadeRight` | Cards alternam entrada da esquerda/direita (x: -60→0 / x: 60→0) |
| How it Works | `scaleIn` | Cards surgem com scale 0.8→1 + opacity, stagger sequencial |
| Features | `fadeUp` + `blur` | filter: blur(8px)→blur(0) + opacity + y |
| Testimonials | `fadeRight` | Todos entram da direita com stagger |
| Blog | `fadeUp` padrão | Manter simples |
| CTA | `fadeUp` + scale | Leve zoom-in no texto central |

### Alterações técnicas

**`src/pages/Index.tsx`** — único arquivo editado:

1. Adicionar novos variants ao topo:
```typescript
const fadeLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0 },
};
const fadeRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0 },
};
const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
};
const fadeBlur = {
  hidden: { opacity: 0, y: 30, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
};
```

2. Criar um `RevealFrom` component que aceita `variant` como prop, para usar variants diferentes por seção sem duplicar código.

3. Aplicar os variants específicos em cada seção, substituindo os `<Reveal>` existentes pelos variants correspondentes.

4. Aumentar o `y` do `fadeUp` padrão de 40 para 60 para tornar mais perceptível.

### O que NÃO muda
- `ScrollDownIndicator` — intocado
- `SteppedShowcase` — intocado (já tem animações internas próprias)
- Estrutura das seções, espaçamento, conteúdo

