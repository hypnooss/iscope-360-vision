

# Corrigir Labels do Donut Usando Coordenadas Reais do Recharts

## Problema Raiz

O componente `OuterLabelsLayer` calcula `cx`, `cy`, angulos e raios de forma independente do Recharts. Se houver QUALQUER diferenca entre esses valores calculados e os que o Recharts usa internamente (margens, resolucao de porcentagens, offsets do viewBox), a deteccao de hemisferio (acima/abaixo do centro) falha, fazendo o texto ir na direcao errada.

## Solucao

Capturar as coordenadas REAIS do Recharts usando o prop `label` do Pie externo (tecnologia). O Recharts passa `cx`, `cy`, `midAngle`, `outerRadius` como props para a funcao de label de cada fatia. Vamos coletar esses dados e usa-los no `OuterLabelsLayer`, eliminando qualquer calculo manual de angulo.

## Detalhes Tecnicos

### 1. Arquivo: `src/components/surface/SeverityTechDonut.tsx`

- Adicionar um `useRef` para armazenar os dados reais de cada fatia do Recharts
- Adicionar uma funcao `label` invisivel (retorna `null`) ao Pie de tecnologia que captura `cx`, `cy`, `midAngle`, `outerRadius` de cada slice e salva no ref
- Passar esses dados capturados para o `OuterLabelsLayer` em vez de `techData` + centro/raio calculados manualmente

```text
// Dentro do SeverityTechDonut:
const sliceDataRef = useRef([]);

function captureSliceData({ cx, cy, midAngle, outerRadius, name, value, percent, fill, index }: any) {
  sliceDataRef.current[index] = { cx, cy, midAngle, outerRadius, name, value, percent, color: fill };
  return null; // Label invisivel, so captura dados
}

// No Pie de tecnologia, adicionar:
<Pie ... label={captureSliceData} labelLine={false}>

// No Customized, passar sliceDataRef.current:
<Customized component={(props) => (
  <OuterLabelsLayer
    sliceData={sliceDataRef.current}
    techData={techData}
    width={props.width}
    height={props.height}
  />
)} />
```

### 2. Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

- Alterar a interface de props para receber `sliceData` (com cx, cy, midAngle, outerRadius reais do Recharts)
- Usar as coordenadas do Recharts para calcular posicoes, usando a formula EXATA do Recharts: `x = cx + r * cos(-midAngle * RADIAN)`, `y = cy + r * sin(-midAngle * RADIAN)`
- Manter toda a logica de anti-colisao existente
- Usar a posicao real `ey2` (calculada com o midAngle do Recharts) para determinar se o texto vai para cima ou para baixo:
  - Se `ey2 > cy` (Recharts real): texto desce (afasta do centro)
  - Se `ey2 <= cy`: texto sobe (afasta do centro)

```text
// Nova formula usando convencao Recharts:
const ex2 = slice.cx + extR * Math.cos(-slice.midAngle * RADIAN);
const ey2 = slice.cy + extR * Math.sin(-slice.midAngle * RADIAN);

// Direcao baseada na posicao REAL:
const textGoesDown = item.ey2 > item.cy;
```

### 3. Resultado Esperado

- "Outros" (fatia na parte inferior): texto vai para BAIXO, afastando do centro
- "Bootstrap"/"SSL" (fatias na parte superior): texto vai para CIMA, afastando do centro
- Itens a direita: texto alinha a direita
- Itens a esquerda: texto alinha a esquerda
- Zero dependencia de calculos manuais de angulo - tudo vem do Recharts

