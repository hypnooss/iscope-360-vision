

## Adicionar Prefixo "DKIM - " ao Nome da Chave

### Problema

Usuários leigos não entendem que "selector1" ou "selector2" são nomes de chaves DKIM. Precisa de contexto mais claro.

### Mudança

**Arquivo:** `src/components/pdf/sections/PDFDNSMap.tsx`

**Antes:**
```typescript
<ValueCard 
  primary={key.selector}
  secondary={key.keySize ? `Tamanho da chave - ${key.keySize} bits` : 'Tamanho desconhecido'}
/>
```

**Depois:**
```typescript
<ValueCard 
  primary={`DKIM - ${key.selector}`}
  secondary={key.keySize ? `Tamanho da chave - ${key.keySize} bits` : 'Tamanho desconhecido'}
/>
```

### Resultado Visual

```text
┌─────────────────────────────────────────────────────────────┐
│  ● DKIM - selector1                                          │
│    Tamanho da chave - 2352 bits                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ● DKIM - selector2                                          │
│    Tamanho da chave - 2352 bits                              │
└─────────────────────────────────────────────────────────────┘
```

### Arquivo Modificado

- `src/components/pdf/sections/PDFDNSMap.tsx` (1 linha)

