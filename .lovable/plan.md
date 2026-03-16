

## Enriquecer seção "Superfície de Ataque" com mini-gráficos

### O que muda

Adicionar 3 mini-gráficos inline (um para cada stat card) usando SVG puro — sem dependências externas. Cada gráfico reforça visualmente a tendência do dado apresentado:

1. **CVEs por ano** — Bar chart mostrando crescimento 2018-2025:
   - 2018: 16,510 | 2019: 17,306 | 2020: 18,325 | 2021: 20,155 | 2022: 25,059 | 2023: 28,902 | 2024: 40,009 | 2025: ~45,000 (projeção)
   - Barra de 2025 em destaque (cor primary)

2. **Tempo de exploração** — Line chart descendente mostrando colapso:
   - 2019: 63 dias | 2020: 44 | 2021: 32 | 2022: 19 | 2023: 5
   - Linha vermelha descendente com ponto final em destaque

3. **Custo médio de breach** — Line chart ascendente:
   - 2020: $3.86M | 2021: $4.24M | 2022: $4.35M | 2023: $4.45M | 2024: $4.88M
   - Linha laranja/amber ascendente

### Implementação

- Criar componente `src/components/landing/MiniChart.tsx` com dois tipos: `bar` e `line`
- SVGs responsivos (~200x80px), estilo dark-mode nativo (cores do tema)
- Integrar abaixo de cada stat card na seção "Problem — Impact Numbers" (linhas 166-182 de Index.tsx)
- Layout muda de texto puro para: número grande + contexto + mini-gráfico abaixo
- Os gráficos aparecem com animação sutil (fade-in via framer-motion)

### Arquivos
- **Criar**: `src/components/landing/MiniChart.tsx`
- **Editar**: `src/pages/Index.tsx` (seção Problem, linhas 152-183)

