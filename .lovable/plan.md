

# Ajuste de Cores e Posicionamento dos Labels Externos

## Problemas Identificados

1. **Cores muito cinza** - A paleta atual (`#5b9aa9`, `#7c8bb8`, etc.) ficou dessaturada demais, perdendo a identidade visual de cada tecnologia
2. **Labels sobrepostos ao grafico** - O `outerRadius` de `65%` esta grande demais para o container, nao deixando espaco suficiente para os labels externos com suas linhas conectoras

## Solucao

### 1. Nova paleta intermediaria

Cores com saturacao moderada - nao tao vibrantes quanto as originais, mas com identidade visual clara no dark mode:

```text
'#4db8a4'   (teal suave)
'#7b8fdb'   (azul lavanda)
'#b07cc3'   (roxo medio)
'#45b5bf'   (ciano suave)
'#c4956a'   (dourado muted)
'#5bae7e'   (verde salvia)
'#8f8bc7'   (indigo suave)
'#c27884'   (rosa dusty)
'#5aa3c9'   (azul steel)
'#a98db5'   (malva)
```

### 2. Reduzir raio do grafico e aumentar distancia dos labels

- Reduzir `outerRadius` do anel externo de `"65%"` para `"55%"` - isso libera mais espaco ao redor do grafico
- Ajustar `innerRadius` do anel externo de `"48%"` para `"42%"` (manter espessura do anel)
- Ajustar anel interno: `innerRadius="15%"` / `outerRadius="36%"`
- Aumentar `extRadius` de `outerRadius + 22` para `outerRadius + 30` para garantir que os labels fiquem bem fora do grafico
- Aumentar `horizLen` de `28` para `35`

### 3. Aumentar container

- Aumentar `min-h` de `320px` para `380px` para acomodar melhor o grafico com labels externos

## Detalhe Tecnico

**Arquivo unico:** `src/components/surface/SeverityTechDonut.tsx`

Alteracoes pontuais:
- Linhas 23-26: substituir array `TECH_COLORS`
- Linha 72: `extRadius = outerRadius + 30`
- Linha 78: `horizLen = 35`
- Linha 203: `min-h-[380px]`
- Linhas 211-212: anel interno `innerRadius="15%"` / `outerRadius="36%"`
- Linhas 228-229: anel externo `innerRadius="42%"` / `outerRadius="55%"`

