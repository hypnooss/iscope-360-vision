

# Corrigir Badges e ASN nos Cards de Saude dos Ativos

## Problemas Identificados

1. O badge de IP usa `font-mono` mas o badge de ASN nao, causando diferenca visual no tamanho da fonte (ambos sao `text-[9px]` mas `font-mono` tem metricas diferentes)
2. A contagem de servicos ("X svc") aparece duplicada nos cards expandidos -- tanto na linha 1 quanto na linha 2
3. Cards sem ASN provavelmente nao tem dados de ASN na fonte (nao e bug de codigo)

## Solucao

### 1. Uniformizar fonte dos badges

Aplicar `font-mono` em ambos os badges (IP e ASN) para consistencia visual, ou remover `font-mono` de ambos. A melhor opcao e manter `font-mono` no IP (faz sentido para numeros) e adicionar `font-mono` tambem no ASN (que contem numeros como AS266446).

### 2. Remover "svc" duplicado no card expandido

No card expandido, a contagem de servicos aparece na linha 1 (junto com hostname/IP/ASN) e tambem na linha 2 (junto com badges de severidade). Remover da linha 2 para evitar duplicacao.

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/surface/AssetHealthGrid.tsx` | Adicionar `font-mono` ao badge de ASN (linhas 116, 145); remover "svc" duplicado da linha 157 |

**Linha 116 e 145** (badge ASN): adicionar `font-mono` a className
**Linha 157**: remover `<span>` de "svc" duplicado da segunda linha do card expandido

