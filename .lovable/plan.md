

# Padronizar header do Surface Analyzer

## Diferencas encontradas

Comparando o Analyzer com as paginas de referencia (Dominios Externos e Firewalls):

| Aspecto | Analyzer (atual) | Padrao (referencia) |
|---|---|---|
| Wrapper do header | `flex items-center justify-between` | `flex flex-col md:flex-row md:items-center md:justify-between gap-4` |
| Botoes | `size="sm"` | sem `size` (tamanho default) |
| Select width | `w-[220px]` | `w-[220px]` (ja esta igual) |

O Select ja esta no padrao. As diferencas reais sao:
1. O wrapper nao tem responsividade (`flex-col md:flex-row`) nem `gap-4`
2. Os botoes usam `size="sm"` enquanto o padrao usa tamanho default

## Mudancas

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**1. Linha 1232 - Wrapper do header**
De: `flex items-center justify-between`
Para: `flex flex-col md:flex-row md:items-center md:justify-between gap-4`

**2. Linha 1252 - Botao "Executar Analise"**
Remover `size="sm"`

**3. Linha 1258 - Botao "Cancelar Analise"**
Remover `size="sm"`

