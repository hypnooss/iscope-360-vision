

# Corrigir Labels Saindo do Card no Lado Esquerdo

## Problema
Para labels do lado esquerdo, `textAnchor="end"` faz o texto renderizar para a ESQUERDA do ponto de ancoragem. O dot fica em `ex3 = 16` (MARGIN), o texto comeca em `textX = 10` (ex3 - 6), mas como o texto "termina" nesse ponto e se estende para a esquerda, nomes longos como "Hikvision Network ..." ultrapassam x=0, saindo do SVG. O `overflow-hidden` no div nao funciona porque o SVG do Recharts tem `overflow: visible` por padrao.

## Solucao
Duas acoes combinadas:

1. Reduzir o truncamento de nomes para 14 caracteres (de 18) -- nomes menores ocupam menos espaco horizontal
2. Adicionar `style={{ overflow: 'hidden' }}` no PieChart para que o proprio SVG corte qualquer conteudo que ultrapasse seus limites

## Detalhes Tecnicos

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

- Reduzir `MAX_LABEL_CHARS` de 18 para 14

### Arquivo: `src/components/surface/SeverityTechDonut.tsx`

- Adicionar `style={{ overflow: 'hidden' }}` no componente `<PieChart>` para que o SVG gerado tenha clipping nativo

