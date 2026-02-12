

# Filtrar IPs privados e APIPA do Attack Surface Scan

## Problema

A funcao `isPrivateIP` na edge function `attack-surface-scan` nao filtra enderecos **169.254.0.0/16 (APIPA/link-local)**, permitindo que IPs como `169.254.10.5`, `169.254.10.6`, etc. aparecam nos resultados do scan.

## Correcao

Adicionar a verificacao do range APIPA na funcao `isPrivateIP` em `supabase/functions/attack-surface-scan/index.ts`:

```
if (a === 169 && b === 254) return true   // APIPA / link-local
```

Apos a correcao, a funcao cobrira todos os ranges privados/reservados:

- 10.0.0.0/8 (classe A privado)
- 172.16.0.0/12 (classe B privado)
- 192.168.0.0/16 (classe C privado)
- 127.0.0.0/8 (loopback)
- 169.254.0.0/16 (APIPA / link-local) -- **NOVO**
- 0.0.0.0/8 (rede atual)
- 224.0.0.0+ (multicast e reservado)

## Arquivo alterado

`supabase/functions/attack-surface-scan/index.ts` -- uma unica linha adicionada na funcao `isPrivateIP` (por volta da linha 17).

## Apos a correcao

Sera necessario fazer um **novo Scan** no workspace IE MADEIRA para que os resultados reflitam a filtragem corrigida. Os IPs APIPA serao descartados automaticamente durante a coleta.
