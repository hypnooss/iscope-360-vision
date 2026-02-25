

# Corrigir matching de modelo Fortinet para End-of-Life

## Problema

A funcao `normalize` na Edge Function converte "FortiGate" para "fg", mas nao trata o prefixo "FGT" usado pelo FortiOS no campo `systemInfo.model`. Isso causa falha de matching para **todos** os modelos, nao apenas o 60E.

Exemplos do bug:

```text
RSS: "FortiGate-60E"   -> normalize -> "fg60e"
FW:  "FGT60E"          -> normalize -> "fgt60e"   (sem match!)

RSS: "FortiGate-200F"  -> normalize -> "fg200f"
FW:  "FGT200F"         -> normalize -> "fgt200f"  (sem match!)
```

## Solucao

Alterar a funcao `normalize` em `supabase/functions/fortinet-hardware-eol/index.ts` (linha 53-55) para converter tambem o prefixo "fgt" para "fg":

```typescript
function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[-\s_]/g, '')
    .replace(/fortigate/i, 'fg')
    .replace(/^fgt/, 'fg');
}
```

Com esta correcao:

```text
RSS: "FortiGate-60E"   -> "fg60e"
FW:  "FGT60E"          -> "fg60e"    (match!)

RSS: "FortiGate-200F"  -> "fg200f"
FW:  "FGT200F"         -> "fg200f"   (match!)
```

## Arquivo a modificar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/fortinet-hardware-eol/index.ts` | Adicionar `.replace(/^fgt/, 'fg')` na funcao normalize (linha 54) |

