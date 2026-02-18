
# Fix: Bordas Escuras/Azuis nas Laterais do Mapa Fullscreen

## Diagnóstico Real

Olhando o print, o problema é duplo:

1. **Cor de fundo errada**: As bordas laterais estão com uma cor azul-escura diferente do preto do mapa. O container pai do `AttackMapFullscreen` tem fundo `bg-black` (#000000), mas o fundo do Leaflet e dos tiles tem cor `#0a0e1a` (azul-escuríssimo). A diferença de cor torna as bordas visíveis.

2. **Mapa não preenche a largura**: Com `noWrap=true` e `fitBounds([-60,-180],[80,180])`, o Leaflet calcula o zoom para que o mundo inteiro caiba horizontalmente. Se o container for muito largo (widescreen), o zoom vai ser baixo e haverá espaço nas bordas superior/inferior, mas se for mais estreito, funciona. No fullscreen de widescreen (1920px+), o mapa fica menor que a tela.

## Causa Raiz

O `MapContainer` tem `style={{ background: '#0a0e1a' }}`, mas o container pai em `AttackMapFullscreen` usa `bg-black`. Quando o Leaflet renderiza com `noWrap`, os tiles param em ±180° de longitude, deixando espaço vazio nas bordas — esse espaço herda a cor do container pai (`bg-black`), que é ligeiramente diferente do `#0a0e1a` do mapa.

## Solução

### Opção A (escolhida): Unificar a cor de fundo

Mudar o container principal do `AttackMapFullscreen` de `bg-black` para `bg-[#0a0e1a]`. Assim, mesmo que o Leaflet não preencha 100% da largura, as bordas ficam invisíveis pois têm a mesma cor do mapa.

Além disso, garantir que o `mapStyle.background` e o CSS do `.leaflet-container` também usem `#0a0e1a`.

### Opção B (complementar): Remover `noWrap` e usar `minZoom` adaptativo

Sem `noWrap`, o Leaflet preenche as bordas com repetições do mapa — o que não queremos. Então mantemos `noWrap=true`, mas ajustamos o `fitBounds` para deixar o mapa usar padding negativo e esticar levemente além dos limites reais, forçando o tile a cobrir toda a tela.

Na prática, `padding: [-20, -20]` (valores negativos) faz o mapa "transbordar" ligeiramente, fazendo os tiles cobrirem as bordas.

## Mudanças

### `src/components/firewall/AttackMapFullscreen.tsx`
- Mudar `bg-black` → `bg-[#0a0e1a]` no container principal

### `src/components/firewall/AttackMap.tsx`
- Alterar `FitWorldBounds`: usar `padding: [-10, -10]` para forçar o mapa a preencher o espaço, ou ajustar os bounds para latitudes menores que forçam um zoom maior
- Garantir que `mapStyle.background` seja `'#0a0e1a'`

### `src/index.css`
- Adicionar `.leaflet-container { background: #0a0e1a !important; }` para garantir que o fundo do container Leaflet seja sempre o mesmo tom

## Resultado Esperado

| Antes | Depois |
|---|---|
| Bordas azul-escuras visíveis nas laterais | Bordas invisíveis (mesma cor do mapa) |
| Diferença de cor entre container e mapa | Cor uniforme `#0a0e1a` em tudo |
| Aspecto "janela no mapa" | Mapa imersivo sem bordas |
