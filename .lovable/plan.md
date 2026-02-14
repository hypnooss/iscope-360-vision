

# Expandir sub-redes CIDR na extracacao de IPs do Firewall

## Problema

O FortiGate retorna o IP da interface no formato `"200.x.x.x 255.255.255.240"` (IP + mascara em dotted-decimal). O codigo atual pega apenas o primeiro IP (`split(' ')[0]`), ignorando que a mascara `/28` indica 14 hosts utilizaveis. Resultado: 13 IPs publicos nao sao escaneados.

## Solucao

Criar uma funcao helper `expandSubnet(ipField)` que:

1. Faz o parse do IP e da mascara (dotted-decimal para prefix length)
2. Calcula o range de hosts utilizaveis (excluindo network e broadcast)
3. Retorna todos os IPs individuais do range
4. Se nao houver mascara (IP unico), retorna apenas o IP original

Aplicar essa funcao nos dois arquivos que contem `extractFirewallIPs`:
- `supabase/functions/run-attack-surface-queue/index.ts`
- `supabase/functions/attack-surface-scan/index.ts`

## Detalhes tecnicos

### Helper `expandSubnet`

```text
Entrada: "200.189.174.208 255.255.255.240"
Mascara 255.255.255.240 = /28 = 16 enderecos
Network: 200.189.174.208 (descartado)
Broadcast: 200.189.174.223 (descartado)
Hosts: 200.189.174.209 ate 200.189.174.222 (14 IPs)
```

Logica:
- Converter IP e mascara para inteiros de 32 bits
- Network = IP & mask
- Broadcast = network | ~mask
- Iterar de network+1 ate broadcast-1
- Filtrar privados com `isPrivateIP()` existente
- Limite de seguranca: se o range tiver mais de 256 hosts (/24 ou maior), retornar apenas o IP original para evitar explosao de tasks

### Mudanca em `extractFirewallIPs`

Antes:
```text
const ipOnly = ipField.split(' ')[0].trim()
// -> gera 1 IP
```

Depois:
```text
const expandedIPs = expandSubnet(ipField)
// -> gera N IPs (ex: 14 para /28)
// Cada IP vira um SourceIP separado com o mesmo label
```

### Arquivos modificados

1. **`supabase/functions/run-attack-surface-queue/index.ts`**
   - Adicionar funcao `expandSubnet()` nos helpers de IP
   - Atualizar `extractFirewallIPs` para usar `expandSubnet` e iterar sobre os IPs expandidos

2. **`supabase/functions/attack-surface-scan/index.ts`**
   - Mesma mudanca: adicionar `expandSubnet()` e atualizar `extractFirewallIPs`

### Exemplo de resultado

Antes: 1 task criada para `wan2`
Depois: 14 tasks criadas para `wan2` (uma por IP utilizavel do /28)

Cada task tera o label `"FirewallName - wan2"` e sera escaneada individualmente pelo pipeline normal (asn_classifier -> nmap_discovery -> nmap_fingerprint -> httpx).

