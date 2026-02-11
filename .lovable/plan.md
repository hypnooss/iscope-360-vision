

# Sparkline - Adicionar area preenchida e aumentar espacamento

## Alteracoes

### 1. `src/components/dashboard/ScoreSparkline.tsx`

- Adicionar um segundo `<linearGradient>` (fill gradient) identico ao do stroke, mas com opacidade baixa (~15-20%) para criar o efeito de area preenchida sob a linha
- Alterar `fill="none"` para `fill={url(#fillGradientId)}` no componente `<Area>`
- O preenchimento tera um degrade vertical (de cima para baixo) que vai da cor do gradiente horizontal com ~20% opacidade ate transparente, criando o efeito visual de "glow" sutil sob a linha

### 2. `src/pages/GeneralDashboardPage.tsx`

- Aumentar o `gap-3` para `gap-6` no container flex que agrupa o sparkline e o Score Atual (linha 191)

Apenas 2 alteracoes pontuais, sem mudanca de arquitetura.
