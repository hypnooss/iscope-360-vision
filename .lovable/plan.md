

## Ajustes: Densidade da areia, efeito zig-zag, e textos

### 1. Aumentar densidade da areia
Reduzir o spread das flat positions de `4.0 x 2.0` para `3.0 x 1.2` e reduzir o `sandScale` multiplier de `1.4` para `1.2`. Isso concentra mais as 18k partículas.

### 2. Efeito zig-zag na areia (como MazeHQ)
Na geração das `aFlatPosition`, em vez de distribuir Y uniformemente, aplicar uma função senoidal baseada em X:
```
flatY = -0.3 + sin(flatX * frequência) * amplitude
```
Isso cria ondulações/"dunas" no plano horizontal que dão o visual de areia de praia com relevo. Vou usar múltiplas frequências (tipo FBM simples em JS) para parecer orgânico.

### 3. Textos
- **"Plataforma de Segurança & Compliance"** (linha 118): adicionar `font-bold` ou `font-semibold`
- **"Plataforma completa para análise..."** (linha 129): mudar `text-muted-foreground` para `text-muted-foreground/80` ou mais claro
- **"Scroll"** (linha 157): mudar `text-muted-foreground/50` para `text-muted-foreground/70`

### Arquivos a alterar
- `src/components/NetworkAnimation.tsx` — flat positions + sand scale
- `src/pages/Index.tsx` — 3 classes de texto

