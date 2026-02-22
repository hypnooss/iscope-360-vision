
# Remover "X svc" da Linha 1 e Expandir Nomes das Severidades

## Resumo

Duas alteracoes visuais nos cards do AssetHealthGrid:

1. **Remover a informacao de quantidade de servicos do final da linha 1** (tanto nos cards "ok" quanto nos cards com achados), ja que essa informacao agora aparece na linha 2 (ContextLine).

2. **Expandir os nomes das severidades na linha 3**: de "2C", "8H", "7M", "1L" para "2 Critical", "8 High", "7 Medium", "1 Low".

## Detalhes tecnicos

**Arquivo**: `src/components/surface/AssetHealthGrid.tsx`

### Mudanca 1 - Cards "ok" (linha 289-292)
Remover o bloco `<div>` com `CheckCircle2` e `{asset.services} svc`. Manter apenas o icone de check sem o texto.

### Mudanca 2 - Cards com achados (linha 316)
Remover `<span>{asset.services} svc</span>`.

### Mudanca 3 - Badges de severidade (linhas 319-324)
Alterar os textos:
- `{asset.counts.critical}C` para `{asset.counts.critical} Critical`
- `{asset.counts.high}H` para `{asset.counts.high} High`
- `{asset.counts.medium}M` para `{asset.counts.medium} Medium`
- `{asset.counts.low}L` para `{asset.counts.low} Low`

Ajustar o tamanho do texto de `text-[9px]` para `text-[10px]` e o padding de `px-1` para `px-1.5` para acomodar os nomes completos.
