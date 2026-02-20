
# Remover Linha Branca do Painel Lateral

## Problema
A linha branca visivel no painel lateral e causada pela borda inferior (`border-b border-border/50`) aplicada ao `SheetHeader` no componente `CategoryDetailSheet.tsx` (linha 47). No tema escuro, essa borda aparece como uma linha clara/branca entre o cabecalho (badges) e o conteudo dos achados.

## Solucao
Remover as classes `border-b border-border/50` do `SheetHeader` para eliminar a linha.

## Detalhe Tecnico

**Arquivo: `src/components/surface/CategoryDetailSheet.tsx`** (linha 47)

Alterar de:
```
className="px-6 pt-6 pb-4 border-b border-border/50 space-y-3"
```
Para:
```
className="px-6 pt-6 pb-4 space-y-3"
```
