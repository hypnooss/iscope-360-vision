

# Sparkline - Aumentar opacidade do fill

## Alteracao

### `src/components/dashboard/ScoreSparkline.tsx`

Aumentar a opacidade do primeiro stop do fill gradient de `0.2` para `0.35`, mantendo o segundo stop (base) em `0` como esta.

Linha atual:
```
<stop offset="0%" ... stopOpacity={0.2} />
```

Nova:
```
<stop offset="0%" ... stopOpacity={0.35} />
```

Apenas 1 valor alterado em 1 arquivo.

