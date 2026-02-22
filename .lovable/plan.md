

# Corrigir Layout dos Cards de Saude dos Ativos

## Problema

Na linha 1 dos cards, o hostname, IP e ASN estao desalinhados: hostname e IP ficam colados, o ASN fica empurrado para a extremidade direita (`ml-auto`), e nao ha separador visual entre os elementos.

## Solucao

Alterar `src/components/surface/AssetHealthGrid.tsx` para:

1. **Agrupar hostname, IP e ASN lado a lado** (sem `ml-auto` no ASN)
2. **Separar com bullet** (`·`) entre hostname, IP e ASN
3. **Exibir IP tambem como badge** (mesmo estilo outline do ASN) para consistencia visual
4. **Alinhar verticalmente** todos os elementos da linha 1 com `items-center`
5. **Mover "X svc" para `ml-auto`** para ficar na extremidade direita

### Layout resultante

**Card com vulnerabilidades:**
```
| Hostname · [IP badge] · [ASN badge]                    X svc |
| [2C] [8H] [9M]                                               |
```

**Card sem vulnerabilidades (compacto):**
```
| Hostname · [IP badge] · [ASN badge]              [check] X svc |
```

### Detalhes tecnicos

- Remover `ml-auto` do Badge de ASN (linhas 136 e 113)
- Adicionar separadores `·` (`<span className="text-muted-foreground/50 text-[10px]">·</span>`) entre hostname, IP badge e ASN badge
- Converter IP de `<span>` para `<Badge variant="outline">` com estilo `text-[9px] font-mono px-1.5 py-0`
- Manter `shrink-0` nos badges para evitar truncamento
- Adicionar `ml-auto` ao container de "svc" / check icon

### Arquivo afetado

| Arquivo | Descricao |
|---------|-----------|
| `src/components/surface/AssetHealthGrid.tsx` | Corrigir alinhamento e separadores na linha 1 dos cards |

