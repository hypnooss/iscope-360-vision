
# Filtrar Interfaces por Role WAN no Attack Surface Analyzer

## Problema

As funções de extração de IPs de firewall aceitam qualquer interface com IP público, sem verificar o papel (role) da interface. Interfaces internas configuradas erroneamente com IPs públicos (ex: SU1-FW port10 192.111.111.3, ITP-FW VLAN50 172.10.10.5) são incluídas no scan, gerando resultados incorretos e desperdício de recursos.

## Causa raiz

Os dados vêm do Compliance de Firewall (step `system_interface` no `task_step_results`). As duas Edge Functions que processam esses dados filtram apenas por `isPrivateIP()`, sem considerar o campo `role` da interface.

## Solucao

Adicionar filtro por `role === 'wan'` em ambas as funções de extração, garantindo que apenas interfaces WAN sejam consideradas como alvos de scan.

## Detalhes tecnicos

### Arquivo 1: `supabase/functions/run-attack-surface-queue/index.ts`

Na função `extractFirewallIPs` (linha ~138), adicionar leitura do campo `role` e filtro:

```typescript
for (const iface of interfaces) {
  const role = (iface.role || '').toLowerCase()
  if (role !== 'wan') continue  // <-- nova linha
  const ipField = iface.ip || ''
  const expandedIPs = expandSubnet(ipField)
  const ifaceName = iface.name || 'unknown'
  for (const expandedIP of expandedIPs) {
    if (expandedIP === '0.0.0.0' || seen.has(expandedIP) || isPrivateIP(expandedIP)) continue
    seen.add(expandedIP)
    ips.push({ ip: expandedIP, source: 'firewall', label: `${firewallName} - ${ifaceName} (WAN)` })
  }
}
```

### Arquivo 2: `supabase/functions/attack-surface-scan/index.ts`

Na função `extractFirewallIPs` (linha ~196), o campo `role` já é lido mas não é usado como filtro. Adicionar a mesma condição:

```typescript
for (const iface of interfaces) {
  const ipField = iface.ip || ''
  const expandedIPs = expandSubnet(ipField)
  const role = (iface.role || '').toLowerCase()
  if (role !== 'wan') continue  // <-- nova linha
  const ifaceName = iface.name || 'unknown'
  const label = `${firewallName} - ${ifaceName} (WAN)`
  for (const expandedIP of expandedIPs) {
    if (expandedIP === '0.0.0.0' || seen.has(expandedIP) || isPrivateIP(expandedIP)) continue
    seen.add(expandedIP)
    ips.push({ ip: expandedIP, source: 'firewall', label })
  }
}
```

### Resumo

| Arquivo | Mudanca |
|---------|---------|
| `run-attack-surface-queue/index.ts` | Adicionar `if (role !== 'wan') continue` no loop de interfaces |
| `attack-surface-scan/index.ts` | Adicionar `if (role !== 'wan') continue` no loop de interfaces |

Ambas as funções precisam ser redeployadas apos a alteracao.
