

# Melhorar Grafico Donut Duplo - Tamanho e Tooltip

## Problemas Atuais

1. **Grafico pequeno**: Os raios sao fixos (inner 45-85, outer 95-130 pixels), entao o grafico nao se adapta ao espaco disponivel do card
2. **Tooltip basico**: Usa o tooltip padrao do recharts com formatacao minima — mostra apenas "valor, nome" sem contexto visual (cor, porcentagem, qual anel pertence)

## Solucao

### 1. Grafico responsivo com raios proporcionais

Substituir os raios fixos por raios baseados em porcentagem usando as props `innerRadius`/`outerRadius` com strings de porcentagem do recharts:

- **Anel interno (Severidade):** `innerRadius="20%"` / `outerRadius="42%"`
- **Anel externo (Tecnologias):** `innerRadius="48%"` / `outerRadius="72%"`

Isso faz o grafico escalar automaticamente com o tamanho do container. Aumentar tambem o `min-h` do container para `min-h-[320px]` e garantir que o card ocupe toda a altura da grid.

### 2. Tooltip customizado e visual

Criar um componente `CustomTooltip` que renderiza:

- Um indicador colorido (bolinha com a cor do segmento)
- Nome completo do item (sem truncar)
- Valor absoluto + porcentagem entre parenteses
- Label do anel ("Severidade" ou "Tecnologia") para contexto
- Estilizado com `bg-popover`, `border-border`, `rounded-lg`, `shadow-lg`, `text-popover-foreground`

### 3. Ajustar labels internos

- Aumentar `fontSize` de 10 para 11
- Ajustar o threshold de exibicao para segmentos com pelo menos 10% (evitar sobreposicao em graficos maiores)
- Usar `fill="#fff"` (branco) em vez de `hsl(var(--foreground))` para melhor contraste sobre as cores dos segmentos

## Detalhe Tecnico

**Arquivo unico:** `src/components/surface/SeverityTechDonut.tsx`

Alteracoes:
- Trocar `innerRadius={45}` etc por strings de porcentagem
- Criar funcao `CustomTooltip` como componente React para a prop `content` do `<Tooltip>`
- Ajustar `renderCustomLabel`: font size, fill branco, threshold 10%
- Container: `min-h-[320px]` em vez de `min-h-[280px]`

