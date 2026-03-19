

## Plano: Corrigir desalinhamentos no diagrama Sankey

### Problemas identificados (setas vermelhas no print)

1. **Barras da esquerda** — a barra de Critical não começa no mesmo Y que a barra de Exploitable na direita; há desalinhamento vertical no topo
2. **Barra Not Exploitable (direita)** — não alcança o fundo; para antes do fim da barra Low na esquerda  
3. **Textos do footer** — desalinhados com as barras laterais

### Causa raiz

O cálculo de `totalLeftH` inclui os `gap`s entre nós, mas as alturas dos fluxos são proporcionais a `totalLeftH` (com gaps), enquanto as alturas dos nós individuais são proporcionais a `usableH` (sem gaps). Essa inconsistência faz os fluxos não baterem com os nós, e o lado direito não cobrir toda a extensão vertical.

### Correção em `src/components/landing/SteppedShowcase.tsx`

1. **Calcular alturas dos nós sem gap, e usar a mesma referência para fluxos e nós direitos:**
   - `totalLeftH` = soma apenas das alturas dos nós (sem gaps)
   - Posição Y de cada nó: acumula `h + gap` (gap é visual, não entra no cálculo proporcional)

2. **Alinhar lado direito exatamente com o primeiro e último Y do lado esquerdo:**
   - `rightNodes[0].y = padTop` (mesmo que o primeiro nó esquerdo)
   - Altura total direita = `lastLeftNode.y + lastLeftNode.h - padTop` (distância real do topo ao fundo das barras esquerdas, incluindo gaps)

3. **Recalcular fluxos proporcionais à altura de cada nó fonte**, não ao total global:
   - Exploit flow height de cada fonte = `(src.exploitable / src.total) * src.h`
   - Not-exploit flow height = `src.h - exploitFlowH`
   - Isso garante que os fluxos de cada nó somem exatamente à altura do nó

4. **Acumular Y no lado direito** considerando a altura real visual (com gaps) para que a barra verde chegue até o fundo

### Arquivo
- `src/components/landing/SteppedShowcase.tsx` (função `RiskChart`, linhas 108-323)

