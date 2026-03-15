

## Landing Page -- Background Animado + Seções Full-Page

### O que muda

**1. Background animado suave (estilo Tiwis.fr)**
O site Tiwis usa um gradiente/orbe que se move suavemente pelo fundo. Vou criar um componente `AnimatedBackground` com 2-3 orbes teal/cyan que se movem lentamente via CSS keyframes (não precisa de canvas/WebGL). O grid quadriculado fica sobreposto com um fade radial nas bordas para que não pareça "cortado".

**2. Remover "Login" do menu e badge do hero**
- Header: remover o botão "Login" do nav (desktop e mobile)
- Hero: remover o bloco da badge "Plataforma de Infraestrutura"

**3. Seções full-page empilhadas (cada seção = 100vh)**
Cada seção principal ocupa `min-h-screen` e é visualmente independente. Sem `SectionDivider` com border-t. Cada seção tem seu próprio fundo com opacidade/gradiente sutil para criar separação natural (alternância de tons escuros levemente diferentes). Isso elimina o problema de uma seção "invadir" a outra.

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/pages/Index.tsx` | Reescrever AnimatedGrid para orbes animados + grid overlay com fade. Cada seção com `min-h-screen flex items-center`. Remover badge, remover SectionDivider. |
| `src/components/Header.tsx` | Remover "Login" do nav desktop e mobile |
| `src/index.css` | Adicionar keyframes para orbes flutuantes (`@keyframes orb-float-1/2/3`), ajustar grid overlay com mask radial fade |

### Detalhes Técnicos

**Background orbes animados:**
```css
/* 3 orbes com trajetórias diferentes, movendo-se lentamente */
@keyframes orb-drift-1 {
  0% { transform: translate(0%, 0%); }
  33% { transform: translate(30%, -20%); }
  66% { transform: translate(-15%, 25%); }
  100% { transform: translate(0%, 0%); }
}
/* Cada orbe: ~400-600px, blur 150-200px, opacity 0.06-0.10, teal */
```
Grid quadriculado sobreposto com `mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%)` para fade nas bordas.

**Seções full-page:**
- Hero: `min-h-screen` centralizado
- Credibility/Metrics: `min-h-screen` com bg levemente diferente (`bg-card/20`)
- Features: `min-h-screen`
- How it Works: `min-h-screen` com bg alternado
- Security: `min-h-screen`
- CTA: `min-h-screen`

Cada seção usa `flex items-center justify-center` para centralizar o conteúdo verticalmente, garantindo que nunca invada o espaço da outra.

**Header simplificado:**
Nav: `Produto | Segurança | Como Funciona` + botão CTA. Sem "Login".

