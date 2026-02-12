
# Corrigir deteccao de IPs publicos do Firewall no Attack Surface Analyzer

## Problema identificado

A funcao `extractFirewallIPs()` no edge function `attack-surface-scan` filtra interfaces exclusivamente por nome/role/type contendo "wan". No firewall IDA-FW da Taschibra, a interface `port20` possui o IP publico `200.170.147.25` mas tem `role: undefined` e `name: port20`, sendo ignorada.

### Dados reais do firewall Taschibra:
- `wan1` (role: wan) -> IP `0.0.0.0` (inativo, ignorado corretamente)
- `wan2` (role: wan) -> IP `177.200.196.230` (capturado, mas via DNS, nao via firewall)
- `port20` (role: undefined) -> IP `200.170.147.25` (IP publico IGNORADO)

## Solucao

Alterar a logica de `extractFirewallIPs()` para capturar **qualquer interface que tenha IP publico**, independente do nome ou role. Se a interface tem um IP valido e nao-privado, ela e relevante para o Attack Surface.

### Arquivo: `supabase/functions/attack-surface-scan/index.ts`

#### Alterar funcao `extractFirewallIPs` (linhas 152-181)

**Logica atual:**
```
Para cada interface:
  - Verificar se nome/role/type contem "wan"
  - Se sim, extrair IP e filtrar privados
```

**Nova logica:**
```
Para cada interface:
  - Extrair o campo IP
  - Se o IP e publico (nao-privado, nao 0.0.0.0):
    - Adicionar ao resultado, usando o nome da interface como label
    - Sem filtro por role ou tipo
```

Isso e mais seguro porque:
- Captura interfaces com nomes customizados (port20, custom-wan, link-externo, etc.)
- Nao depende do administrador ter configurado o role corretamente
- IPs privados (RFC1918, loopback, APIPA) continuam filtrados automaticamente por `isPrivateIP()`
- Interfaces sem IP (0.0.0.0) continuam ignoradas

#### Melhorar o label

O label indicara o tipo de interface quando possivel:
- Se role = "wan": `"FirewallName - InterfaceName (WAN)"`
- Se role = outro: `"FirewallName - InterfaceName"`

### Resultado esperado

Apos a correcao, um novo scan da Taschibra devera identificar:
- `177.200.196.230` (wan2) -> source: firewall
- `200.170.147.25` (port20) -> source: firewall
- Todos os IPs de DNS (mantidos como estao)
