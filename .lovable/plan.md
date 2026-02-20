
# Ajustar Grafico Donut Duplo - Remover Legenda e Expandir

## Resumo

Remover a legenda separada do componente `SeverityTechDonut`, fazer o grafico ocupar todo o espaco disponivel do card e usar labels integrados no proprio grafico (recharts `Label`/`renderCustomizedLabel`) para porcionamentos maiores, enquanto porcoes pequenas mostram dados apenas via tooltip no hover.

## Detalhe Tecnico

**Arquivo:** `src/components/surface/SeverityTechDonut.tsx`

1. **Remover toda a secao de legenda** (linhas 134-161 — o grid com "Severidade" e "Tecnologias")
2. **Expandir altura do grafico** de `h-[220px]` para `h-full` com o container usando `flex-1` para ocupar todo o espaco restante do card. O Card recebe `flex flex-col` e o CardContent recebe `flex-1`
3. **Aumentar raios dos aneis** para preencher melhor o espaco maior:
   - Inner ring: `innerRadius={45}` / `outerRadius={85}`
   - Outer ring: `innerRadius={95}` / `outerRadius={130}`
4. **Adicionar labels customizados** nos segmentos maiores usando a prop `label` do Pie com uma funcao `renderCustomizedLabel` que:
   - Calcula a porcentagem do segmento em relacao ao total
   - Se a porcentagem for maior que ~8-10%, renderiza o nome abreviado + valor dentro/ao lado do arco
   - Se for menor, nao renderiza label (o tooltip ja cobre)
5. **Manter o Tooltip** existente para exibir nome completo + valor ao passar o mouse em qualquer segmento (inclusive nos pequenos sem label)
6. **Remover o padding** desnecessario: `CardHeader` com `pb-2` e `CardContent` com `flex-1 pt-0 pb-2`
