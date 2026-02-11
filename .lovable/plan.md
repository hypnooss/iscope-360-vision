

# Ajustar Espacamento entre Colunas e Centralizar Texto

## Problemas Identificados

1. Gap entre as colunas "CVEs" e "Conformidade" muito pequeno (gap-6 insuficiente)
2. Texto "Ultima analise" alinhado a esquerda, precisa ser centralizado

## Alteracoes

### Arquivo: `src/pages/GeneralDashboardPage.tsx`

**Linha 146** - Aumentar gap entre colunas de severidade:
- Trocar `flex gap-6` por `flex gap-10` para dar mais respiro entre as duas colunas

**Linha 155** - Centralizar texto da ultima analise:
- Adicionar `text-center` ao paragrafo de "Ultima analise"

