
# Fix: Mapa Extravasando para os Lados (Cópias do Mundo)

## Diagnóstico

No print, o mapa está mostrando **3 cópias do mundo** lado a lado — uma à esquerda, uma ao centro, uma à direita. Isso é comportamento padrão do Leaflet quando o zoom está baixo o suficiente para que o mundo inteiro caiba menos que a largura do container, e a opção `maxBounds` não está definida.

O problema específico:
- `zoom={2}` num container largo exibe o planisfério completo e ainda sobra espaço para cópias repetidas
- Sem `maxBounds`, o Leaflet preenche as bordas com repetições do mapa
- Sem `maxBoundsViscosity`, o usuário (no fullscreen) pode arrastar para fora dos limites

## Solução

### 1. Adicionar `maxBounds` para limitar a uma cópia do mundo

```tsx
const WORLD_BOUNDS = new LatLngBounds([-90, -180], [90, 180]);

<MapContainer
  maxBounds={WORLD_BOUNDS}
  maxBoundsViscosity={1.0}   // impede arrastar além dos limites
  ...
>
```

### 2. Ajustar `minZoom` para evitar encolher demais

Com `maxBounds` definido, o Leaflet calcula automaticamente o zoom mínimo para que o mundo preencha o container sem deixar espaço para repetições. Mas precisamos garantir que `minZoom` não seja menor que esse valor calculado.

A solução mais robusta é usar o hook `useMap()` dentro de um componente filho para chamar `map.fitBounds(WORLD_BOUNDS)` ao inicializar — isso garante que o zoom inicial mostre exatamente o mundo inteiro sem repetições, independente do tamanho do container.

```tsx
function FitWorldBounds() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds([[-75, -180], [85, 180]], { animate: false });
  }, [map]);
  return null;
}
```

### 3. Desativar `worldCopyJump` (modo inline)

No modo inline (não fullscreen), também desativar o `worldCopyJump` que contribui para as repetições laterais.

```tsx
<MapContainer
  worldCopyJump={false}
  noWrap={true}   // nos tiles
  ...
>
  <TileLayer noWrap={true} ... />
```

### 4. Centro e zoom inicial

Atualizar o centro inicial para `[20, 0]` (mais centralizado no planisfério) e remover o `zoom={2}` fixo — deixar o `FitWorldBounds` calcular o zoom correto automaticamente para o tamanho do container.

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `src/components/firewall/AttackMap.tsx` | Adicionar `maxBounds`, `FitWorldBounds`, `noWrap` nos tiles, desativar `worldCopyJump` |

## Resultado Esperado

| Situação | Antes | Depois |
|---|---|---|
| Modo inline (dashboard) | 3 cópias do mundo visíveis | 1 cópia ajustada à largura do card ✓ |
| Modo fullscreen | Cópias nas laterais | Mundo limitado a uma instância ✓ |
| Arrastar (fullscreen) | Pode sair dos limites | Limitado a ±180° de longitude ✓ |
| Zoom inicial | Fixo em 2 (pode ser grande/pequeno demais) | Calculado para preencher o container ✓ |
