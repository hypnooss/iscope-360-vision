

# Incluir cloud_public_ip no Preview do Surface Analyzer

## Problema

A edge function `attack-surface-preview` (que popula o dialogo "Selecionar Alvos do Scan") busca firewalls com `select('id, name')` e extrai IPs apenas das interfaces WAN via step results. O campo `cloud_public_ip` nao e consultado, entao firewalls em cloud com IPs privados nas interfaces nao aparecem.

## Solucao

Alterar a edge function `attack-surface-preview/index.ts` para:

1. Incluir `cloud_public_ip` no select dos firewalls (linha 228): `select('id, name, cloud_public_ip')`
2. Apos extrair targets das interfaces WAN, verificar se o firewall tem `cloud_public_ip` preenchido e publico
3. Se sim, adicionar como um FirewallTarget adicional com label "FW-Name - Cloud Public IP" e `expanded_ips: [cloud_public_ip]`

### Detalhe tecnico

No loop de firewalls (linha 233), apos processar os step results de interfaces WAN, adicionar:

```text
if (fw.cloud_public_ip && !isPrivateIP(fw.cloud_public_ip) && !seenDNS.has(fw.cloud_public_ip)) {
  // Verificar se o IP ja nao foi incluido nos targets de interface
  const alreadyIncluded = firewallTargets.some(ft => ft.expanded_ips.includes(fw.cloud_public_ip));
  if (!alreadyIncluded) {
    firewallTargets.push({
      ip: fw.cloud_public_ip,
      label: `${fw.name} - Cloud Public IP`,
      subnet: null,
      expanded_ips: [fw.cloud_public_ip],
    });
  }
}
```

### Arquivo afetado

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/attack-surface-preview/index.ts` | Incluir cloud_public_ip no select e adicionar como alvo |

Apenas uma alteracao pequena e localizada. O deploy da edge function sera feito apos a edicao.

