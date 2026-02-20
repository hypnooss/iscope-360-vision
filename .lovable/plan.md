

# Labels Externos com Anti-Colisao Manual

## Problema

O Recharts nao possui deteccao de colisao para labels de pie charts. A prop `label` renderiza cada label independentemente com base no angulo do segmento, causando sobreposicao quando segmentos sao pequenos ou adjacentes. Isso e uma limitacao conhecida do Recharts - nao existe configuracao que resolva isso.

## Solucao

Abandonar a prop `label` do Recharts para o anel externo e renderizar os labels manualmente usando o componente `<Customized>` do Recharts, com logica propria de posicionamento e anti-colisao.

## Como funciona

1. Separar os labels em dois grupos: lado direito (angulo 0-180) e lado esquerdo (180-360)
2. Dentro de cada grupo, ordenar por posicao Y
3. Aplicar espacamento minimo vertical (ex: 28px) entre labels consecutivos - se dois labels ficarem muito proximos, empurrar o de baixo para baixo
4. Desenhar as linhas conectoras (polylines) do segmento ate a posicao final ajustada do label

## Detalhe Tecnico

**Arquivo:** `src/components/surface/SeverityTechDonut.tsx`

### 1. Remover `label={renderOuterLabel}` do Pie externo

O segundo `<Pie>` passa a nao ter prop `label` - os labels serao desenhados pelo componente customizado.

### 2. Criar componente `OuterLabelsLayer`

Componente que recebe `techData` e as dimensoes do grafico e:
- Calcula o angulo medio de cada segmento a partir dos dados
- Calcula a posicao Y natural de cada label (baseada no angulo)
- Separa em grupo esquerdo e direito
- Aplica resolucao de colisao: percorre cada grupo de cima para baixo, garantindo `minSpacing = 28px` entre labels consecutivos
- Renderiza `<g>` SVG com polylines e textos nas posicoes ajustadas
- Posiciona os textos em colunas fixas (ex: `cx + colX` para direita, `cx - colX` para esquerda) para alinhamento limpo

### 3. Usar `<Customized>` do Recharts

```text
<Customized
  component={(props) => (
    <OuterLabelsLayer
      techData={techData}
      cx={props.width / 2}
      cy={props.height / 2}
      outerRadius={props.width * 0.55 / 2}
    />
  )}
/>
```

Isso garante que os labels sao renderizados no mesmo SVG do grafico mas com posicionamento controlado manualmente.

### 4. A funcao `renderOuterLabel` sera removida

Nao e mais necessaria pois a logica de labels externos passa a ser do `OuterLabelsLayer`.

### 5. Manter tudo o mais

- Anel interno com `renderCustomLabel` (labels dentro dos segmentos)
- Tooltip customizado para ambos os aneis
- Cores e dados inalterados

