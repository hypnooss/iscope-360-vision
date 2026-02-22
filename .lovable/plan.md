

# Corrigir Exibicao do Badge de ASN

## Problema

O badge de ASN no card compacto (sem vulnerabilidades) tem a classe `hidden sm:inline-flex`, o que faz ele sumir em telas menores que 640px. Se a janela de preview estiver estreita, o ASN nao aparece.

## Solucao

Remover `hidden sm:inline-flex` do badge de ASN no card compacto (linha 116), deixando apenas `shrink-0` para evitar truncamento. Assim o ASN sera visivel em qualquer viewport, igual ao card expandido.

### Detalhe tecnico

| Arquivo | Linha | Mudanca |
|---------|-------|---------|
| `src/components/surface/AssetHealthGrid.tsx` | 116 | Remover `hidden sm:inline-flex` da className do Badge de ASN |

Antes:
```
className="text-[9px] font-mono px-1.5 py-0 text-muted-foreground border-border/60 shrink-0 hidden sm:inline-flex"
```

Depois:
```
className="text-[9px] font-mono px-1.5 py-0 text-muted-foreground border-border/60 shrink-0"
```

