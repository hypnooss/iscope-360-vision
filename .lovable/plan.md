

# Fix: Excluir tráfego `subtype=local` de "Entrada Bloqueada" e "Entrada Permitida"

## Diagnóstico

Consultei os logs de `denied_traffic` do BAU-FW no banco de dados. Os 6 registros do seu IP (186.207.252.255) têm:

| Campo | Valor |
|---|---|
| srcip | 186.207.252.255 |
| dstip | 187.32.89.65 (WAN do firewall) |
| dstport | 444 (admin HTTPS) |
| subtype | **local** |
| policyid | **0** (implicit deny) |
| msg | "Connection Failed" |

**Todos os 103 logs de denied_traffic são `subtype=local`** — tráfego destinado ao próprio firewall (management plane), não tráfego sendo roteado/encaminhado pela rede (data plane).

No FortiGate:
- `subtype=forward` = tráfego sendo encaminhado/roteado pelo firewall (transit traffic)
- `subtype=local` = tráfego destinado ao próprio firewall (admin, ping, VPN, etc.)

O seu IP aparece em "Entrada Bloqueada" porque o FortiGate registra "Connection Failed" para sessões administrativas que tiveram pacotes descartados (timeout SSL, renegociação, keepalive). Isso não representa tráfego realmente "bloqueado" — é artefato do management plane.

## Correção

Filtrar `subtype=local` nas classificações de entrada. "Entrada Bloqueada" e "Entrada Permitida" devem considerar apenas `subtype=forward`:

**Arquivo: `supabase/functions/firewall-analyzer/index.ts`**

### 1. `analyzeDeniedTraffic` (~linha 144)

Adicionar filtro de subtype ao classificar inbound blocked:

```text
// Antes:
if (!isPrivateIP(srcip) && (!dstip || !isPrivateIP(dstip)))

// Depois:
const subtype = (log.subtype || '').toLowerCase();
if (!isPrivateIP(srcip) && (!dstip || !isPrivateIP(dstip)) && subtype !== 'local')
```

Entrada bloqueada = src público, dst público, **e subtype diferente de local** (apenas tráfego transit/forward).

### 2. `isInboundCandidate` em `analyzeOutboundTraffic` (~linha 924)

Adicionar filtro de subtype:

```text
// Antes:
const isInboundCandidate = (log: any) => {
  const src = log.srcip || log.src || '';
  const dst = log.dstip || log.dst || '';
  return src && !isPrivateIP(src) && dst && !isPrivateIP(dst);
};

// Depois:
const isInboundCandidate = (log: any) => {
  const src = log.srcip || log.src || '';
  const dst = log.dstip || log.dst || '';
  const subtype = (log.subtype || '').toLowerCase();
  if (subtype === 'local') return false;
  return src && !isPrivateIP(src) && dst && !isPrivateIP(dst);
};
```

## Arquivos a alterar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/firewall-analyzer/index.ts` | Excluir `subtype=local` das classificações de Entrada Bloqueada e Entrada Permitida |

## Nota

Com esta correção, o BAU-FW provavelmente terá "Entrada Bloqueada" e "Entrada Permitida" vazios, pois todo o tráfego negado atual é `subtype=local`. Isso está correto — o firewall não tem serviços publicados (NAT/port forwarding) gerando tráfego forward de entrada. Quando houver, os dados aparecerão corretamente.

