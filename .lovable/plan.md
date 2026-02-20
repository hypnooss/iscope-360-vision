

# Ajustes no Donut Duplo - Cores, Tamanho de Texto e Espacamento

## Resumo

Tres ajustes no componente `SeverityTechDonut.tsx`:

1. **Paleta do anel externo (Tecnologias)** - Trocar as cores vibrantes por tons mais suaves e dessaturados que harmonizam com o fundo escuro sem competir visualmente com as cores de severidade
2. **Tamanho do texto dos labels externos** - Aumentar fontSize do nome para 11 e do valor para 10
3. **Maior distancia entre labels e grafico** - Aumentar o `extRadius` (extensao radial) e o `horizLen` (extensao horizontal) para afastar os labels do anel

## Detalhe Tecnico

**Arquivo:** `src/components/surface/SeverityTechDonut.tsx`

### 1. Nova paleta de cores para tecnologias (linha 23-26)

Substituir `TECH_COLORS` por tons mais frios/dessaturados que nao competem com vermelho/laranja/amarelo do anel de severidade:

```text
Antes:  '#14b8a6', '#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#22c55e', '#6366f1', '#e11d48', '#0ea5e9', '#a855f7'
Depois: '#5b9aa9', '#7c8bb8', '#8a7fa8', '#6ba3a0', '#9ca3af', '#7a9b8d', '#8691a8', '#a0929b', '#6d97a8', '#8b8fa3'
```

Tons pasteis/cinza-azulados que ficam elegantes no dark mode sem poluicao visual.

### 2. Distancia dos labels externos (linhas 72, 78)

- `extRadius`: de `outerRadius + 14` para `outerRadius + 22` (mais afastado radialmente)
- `horizLen`: de `18` para `28` (linha horizontal mais longa)
- `textX` offset: de `6` para `8`

### 3. Tamanho do texto (linhas 100, 111)

- Nome da tecnologia: fontSize de `10` para `11`
- Valor + porcentagem: fontSize de `9` para `10`
- Espaco entre linhas: `ey3 + 12` para `ey3 + 14`

