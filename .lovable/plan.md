

# Ajustes no UnifiedComplianceCard

## Mudanca 1: Remover codigo da regra do card

No header do card (Nivel 1), remover a exibicao do `item.code` e o separador "bullet", mantendo apenas o nome da regra.

**Antes:** `EXO-001 • Configuracao DKIM`
**Depois:** `Configuracao DKIM`

## Mudanca 2: Exibir descricao em todos os status

A logica de `contextualMessage` ja cobre todos os status, porem quando `passDescription` ou `notFoundDescription` nao estao definidos, nada e exibido. Ajustar o fallback para sempre exibir `item.description` quando a descricao contextual especifica nao existir.

**Antes:**
```
pass -> passDescription (pode ser undefined, nada aparece)
```

**Depois:**
```
pass -> passDescription || description (sempre mostra algo se houver)
```

## Detalhes Tecnicos

Arquivo: `src/components/compliance/UnifiedComplianceCard.tsx`

**Mudanca 1** — Remover linhas do code e separador (~linhas 180-185), manter apenas o `item.name`.

**Mudanca 2** — Atualizar a funcao `contextualMessage` para incluir fallback em todos os casos:

```typescript
const contextualMessage = (() => {
  switch (item.status) {
    case 'pass': return item.passDescription || item.description;
    case 'fail': return item.failDescription || item.description;
    case 'not_found': return item.notFoundDescription || item.description;
    default: return item.description;
  }
})();
```

