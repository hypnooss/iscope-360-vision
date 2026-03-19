

## Plano: Separação entre barras direitas + quebra de linha em "Not Exploitable"

### Mudanças em `src/components/landing/SteppedShowcase.tsx`

1. **Adicionar gap entre Exploitable e Not Exploitable (lado direito)**
   - Linha 157: inserir um gap de ~4px entre as duas barras direitas: `y: padTop + exploitH + 4` e `h: notExploitH - 4`
   - Linha 174: ajustar `notExploitYRight` para `rightNodes[1].y` (já faz isso, mas confirmar que os fluxos respeitam o gap)

2. **Quebrar "Not Exploitable" em duas linhas no SVG**
   - Linhas 310-324: substituir o `<motion.text>` do label por dois `<tspan>` — "Not" na primeira linha e "Exploitable" na segunda — para que o texto não ultrapasse o card

