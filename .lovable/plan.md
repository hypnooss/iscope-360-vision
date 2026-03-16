

## Ajustes na Landing Page

### Mudanças

**1. Remover glow exagerado (Hero + CTA)**

- **Hero** (linha 96): Remover o `radial-gradient` com `hsl(175_80%_45%/0.1)` que cria o glow verde atrás do globo
- **Hero buttons** (linha 128): Reduzir/remover o `shadow-[0_0_30px...]` e `hover:shadow-[0_0_50px...]`
- **CTA section** (linha 471): Remover o blur circle de 600px (`bg-primary/5 blur-[120px]`)
- **CTA button** (linha 496): Reduzir/remover o `shadow-[0_0_40px...]` e `hover:shadow-[0_0_60px...]`

**2. Globo maior**

- `NetworkAnimation`: Aumentar o `sphereRadius` de `Math.min(w, h) * 0.42` para ~`0.55` para que o globo ocupe mais espaço visual na seção hero

**3. Remover botão "Acessar Plataforma" do CTA final**

- Na seção CTA (linhas 493-498), remover o botão "Acessar Plataforma" e manter apenas o "Falar com especialista" (ou ajustar o layout para ter apenas um CTA principal diferente)

**4. Adicionar ícone ao botão do header**

- Em `Header.tsx` (linha 68), adicionar um ícone (ex: `LogIn` ou `ArrowRight` do lucide) ao botão "Acessar Plataforma" no navbar

### Arquivos afetados
- `src/pages/Index.tsx` — remover glows, remover botão CTA
- `src/components/NetworkAnimation.tsx` — aumentar raio do globo
- `src/components/Header.tsx` — adicionar ícone ao botão

