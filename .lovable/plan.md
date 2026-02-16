

# Corrigir exibicao de interfaces Firewall no dialog de preview

## Problema

A edge function `attack-surface-preview` possui uma verificacao de sobreposicao (overlap) na linha 255 que remove **todo o bloco de firewall** se qualquer um dos IPs expandidos ja existir na lista de DNS. No caso do cliente Taschibra:

- DNS contem `177.200.196.230` (ida-fw.taschibra.com.br)
- Firewall wan2 tem subnet `177.200.196.230/29`, que expande para IPs .225 a .230
- Como `.230` ja esta no DNS, o firewall inteiro e descartado
- wan1 tem IP `0.0.0.0` e e filtrada por ser invalida

## Solucao

Alterar a logica de deduplicacao para **remover apenas os IPs sobrepostos** do `expanded_ips` em vez de descartar a interface inteira. Se ainda restarem IPs apos a filtragem, a interface aparece normalmente.

## Detalhes tecnicos

No arquivo `supabase/functions/attack-surface-preview/index.ts`, substituir o bloco de overlap (linhas 253-259):

**Antes:**
```typescript
const hasOverlap = ft.expanded_ips.some(eip => seenDNS.has(eip))
if (!hasOverlap) {
  firewallTargets.push(ft)
}
```

**Depois:**
```typescript
const filteredIPs = ft.expanded_ips.filter(eip => !seenDNS.has(eip))
if (filteredIPs.length > 0) {
  firewallTargets.push({ ...ft, expanded_ips: filteredIPs })
}
```

Isso mantem a deduplicacao (nao scannear IPs ja cobertos pelo DNS), mas preserva a visibilidade da interface com os IPs restantes.

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/attack-surface-preview/index.ts` | Corrigir logica de overlap para filtrar IPs individuais em vez de descartar interface inteira |

