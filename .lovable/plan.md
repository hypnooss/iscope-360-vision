
# Fix: Layout do AttackMap Fullscreen — z-index, Bordas e Sobreposição

## Diagnóstico dos 3 Problemas

### Problema 1: Elementos ficando atrás do mapa (legenda, firewall name)
O Leaflet define z-index interno nos seus panes via CSS:
- `.leaflet-map-pane` → z-index: 400
- `.leaflet-tile-pane` → z-index: 200
- `.leaflet-overlay-pane` → z-index: 400
- `.leaflet-marker-pane` → z-index: 600

O `AttackMapFullscreen` usa `z-20` (Tailwind = z-index: 20) nos overlays. Como o Leaflet já tem z-index 400+, os painéis "Top Origens de Ataque", "Voltar", nome do firewall e barra inferior ficam **atrás** do mapa.

**Fix**: Mudar os overlays do `AttackMapFullscreen` de `z-20` → `z-[1000]` (acima do z-index máximo do Leaflet que é 650 para popups).

### Problema 2: Bordas azuis nas laterais
O CSS padrão do Leaflet injeta:
```css
.leaflet-container {
  outline: none; /* às vezes não funciona em todos os browsers */
}
.leaflet-container:focus {
  outline: 2px solid #0078d7; /* ou similar */
}
```
Além disso, o próprio div container pode ter border/outline azul de foco do browser.

**Fix**: Adicionar CSS global para remover outline/border do container Leaflet:
```css
.leaflet-container {
  outline: none !important;
  border: none !important;
}
.leaflet-container:focus {
  outline: none !important;
}
```

### Problema 3: Mapa não preenchendo corretamente o fullscreen
A estrutura atual:
```
div.fixed.flex-col         ← sem height explícito além do inset-0
  div.absolute (top bar)   ← ok
  div.flex-1.h-full        ← flex-1 + h-full conflita
    AttackMap (h-full)     ← não sabe qual é o pai
```

O `flex-1` já distribui o espaço restante corretamente, mas `h-full` dentro de `flex-1` é redundante e pode causar comportamento inesperado. O container pai precisa ter `h-full` explicitamente.

**Fix**: Remover `h-full` do wrapper do mapa (deixar só `flex-1`), garantir que o container pai `fixed inset-0` tenha altura implícita (`inset-0` = top/right/bottom/left: 0, o que já define a altura).

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `src/components/firewall/AttackMapFullscreen.tsx` | z-index de `z-20` → `z-[1000]` nos overlays, corrigir estrutura do wrapper do mapa |
| `src/index.css` | CSS global para remover outline/border do Leaflet |

## Mudanças Específicas

### `AttackMapFullscreen.tsx`

**Top bar** (linha 63): `z-20` → `z-[1000]`
```tsx
<div className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between px-6 py-4">
```

**Right panel** (linha 96): `z-20` → `z-[1000]`
```tsx
<div className="absolute top-20 right-4 z-[1000] w-56 bg-black/70 ...">
```

**Bottom stats bar** (linha 134): `z-20` → `z-[1000]`
```tsx
<div className="absolute bottom-0 left-0 right-0 z-[1000] bg-black/70 ...">
```

**Wrapper do mapa** (linha 85): remover `h-full`, manter só `flex-1 w-full`
```tsx
<div className="flex-1 w-full min-h-0">
```
O `min-h-0` é necessário para que o flex-1 não estoure quando o filho tem altura maior que o esperado.

### `src/index.css`

Adicionar após as importações existentes do Leaflet:
```css
/* Fix Leaflet container focus outline / blue borders */
.leaflet-container {
  outline: none !important;
  border: none !important;
}
.leaflet-container:focus,
.leaflet-container:focus-visible {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}
```

## Resultado Esperado

| Problema | Antes | Depois |
|---|---|---|
| "Top Origens de Ataque" sumindo | Atrás do mapa (z-index 400) | Visível na frente (z-index 1000) |
| Nome do firewall sumindo | Atrás do mapa | Visível no topo direito |
| Barra de legenda (Auth/Denied) | Atrás do mapa | Visível na base |
| Botão "Voltar" | Possivelmente atrás | Visível no topo esquerdo |
| Bordas azuis laterais | Visíveis | Removidas via CSS |
| Altura do mapa no fullscreen | Pode não preencher tudo | `flex-1 min-h-0` preenche corretamente |
