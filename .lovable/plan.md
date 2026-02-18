
# Causa Raiz Identificada

O azul **não vem** do componente React — vem do `src/index.css`, linha 15:

```css
.leaflet-container {
  background: #0a0e1a !important;  /* azul marinho escuro */
}
.leaflet-tile-pane {
  background: #0a0e1a;
}
```

O `!important` sobrescreve qualquer `background` passado via inline style no `MapContainer`. Por isso todas as tentativas anteriores não funcionaram — o problema estava no CSS global, não nos componentes.

## Correção

Trocar `#0a0e1a` por `#222222` em ambas as ocorrências no `src/index.css`:

```css
.leaflet-container {
  background: #222222 !important;
}
.leaflet-tile-pane {
  background: #222222;
}
```

## Arquivo

- **`src/index.css`** — linhas 15 e 25: trocar `#0a0e1a` por `#222222`
