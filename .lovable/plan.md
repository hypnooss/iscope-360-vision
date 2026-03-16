

## Reposicionar e Refatorar o SteppedShowcase

### Mudanças

**1. Reposicionar** — Mover `<SteppedShowcase />` de após "O problema real" para após a seção "Tudo que você precisa em um só lugar" (Features, `id="features"`).

Em `src/pages/Index.tsx`, remover a linha 296 e inserir `<SteppedShowcase />` após o fechamento da Section de Features (após linha 364).

**2. Refatorar a Timeline/ProgressBar** — A barra de progresso atual ocupa toda a largura e tem dots redundantes. Melhorias:
- Reduzir largura máxima para `max-w-[600px]` centralizado
- Substituir os 30 dots por uma linha contínua fina com preenchimento animado (gradient)
- Remover o dot flutuante absoluto (que tem problemas de posicionamento) e usar um indicador integrado nos números
- Cada número (01, 02, 03) recebe um círculo com borda que preenche quando ativo, com escala suave
- Adicionar título curto abaixo de cada número ("Identificar", "Priorizar", "Remediar")

**3. Melhorar o formato de exibição** — No painel esquerdo de texto:
- Adicionar o número do step como label decorativo grande e translúcido (ex: "01" em `text-8xl opacity-10`) atrás do título
- Adicionar um badge/pill com o tema do step (ex: "Identificação", "Priorização", "Remediação")

**4. Melhorar transições** — As transições atuais são baseadas em faixas de opacity calculadas manualmente. Melhorias:
- Adicionar `translateY` aos crossfades (texto sobe ao sair, desce ao entrar) usando `useTransform` do framer-motion vinculado ao scroll
- Adicionar leve `scale` (0.95 → 1) nos visuais do lado direito ao entrar
- Os CVE cards no step 1 entram com stagger e leve rotação
- O SankeyChart no step 2 entra com slide da direita
- O Workflow no step 3 entra com stagger mais pronunciado nos cards

### Arquivos afetados
- `src/pages/Index.tsx` — mover posição do componente
- `src/components/landing/SteppedShowcase.tsx` — refatorar ProgressBar, melhorar transições e layout

