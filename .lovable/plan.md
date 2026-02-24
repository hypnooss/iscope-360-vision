

# Fix: Logica de Entrada Bloqueada e Entrada Permitida

## Problema

A logica atual define trafego de entrada como "IP publico → IP privado", mas isso nunca ocorre nos logs do FortiGate. O firewall registra os IPs **antes do NAT**, entao trafego de entrada aparece como **IP publico (atacante) → IP publico (WAN do firewall)**. Por isso os dados estao sempre vazios.

## Fluxos corretos

| Direcao | Origem | Destino | Exemplo |
|---|---|---|---|
| **Saida** | Privado (RFC1918) | Publico | 172.16.10.5 → 8.8.8.8 |
| **Entrada** | Publico | Publico (WAN do FW) | 45.33.22.11 → 200.150.10.1 |

Ou seja: **Entrada = ambos os IPs sao publicos** (src publico, dst publico).

## Alteracao

**Arquivo: `supabase/functions/firewall-analyzer/index.ts`**

### 1. `analyzeDeniedTraffic` (linha 145)

```text
// Antes:
if (!isPrivateIP(srcip) && (!dstip || isPrivateIP(dstip)))

// Depois:
if (!isPrivateIP(srcip) && (!dstip || !isPrivateIP(dstip)))
```

Entrada bloqueada = src publico E dst publico (ou sem dst).

### 2. `isInboundCandidate` em `analyzeOutboundTraffic` (linhas 923-928)

```text
// Antes:
return src && !isPrivateIP(src) && dst && isPrivateIP(dst);

// Depois:
return src && !isPrivateIP(src) && dst && !isPrivateIP(dst);
```

Entrada permitida = src publico E dst publico.

### 3. Ajustar filtro de `blockedLogs` para saida (outbound blocked)

Atualmente os `blockedLogs` passados ao `analyzeOutboundTraffic` sao pre-filtrados externamente. Preciso verificar se esse filtro ja isola corretamente apenas saida (privado → publico), ou se tambem inclui entrada (publico → publico). Se necessario, garantir que o outbound blocked use apenas logs com src privado.

## Arquivos a alterar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/firewall-analyzer/index.ts` | Corrigir condicao de inbound: `!isPrivateIP(dst)` ao inves de `isPrivateIP(dst)` em ambas as funcoes |

## Nota

Apos deploy, re-executar coleta para popular os dados corretamente.

