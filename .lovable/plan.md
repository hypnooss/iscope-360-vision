
# Fix: Firewall nao aparece no Mapa de Ataques

## Causa raiz

Dois problemas foram identificados:

1. **IP privado**: O firewall "BAU-FW" tem `fortigate_url: https://172.16.10.2:40443` (IP privado RFC1918). A API `ipwho.is` retorna `success: false` para IPs privados, portanto `firewallGeo` fica null e nada e renderizado no mapa.

2. **Mesmo para DNS publico** (ex: BR-PMP-FW-001 com `br-pmp-fw-001.gdmseeds.com`): a funcionalidade funciona, mas o firewall selecionado atualmente (BAU-FW) tem IP privado.

## Solucao

Implementar uma estrategia de fallback em cascata para obter a geolocalizacao:

1. **Tentativa 1**: Resolver hostname do `fortigate_url` via `ipwho.is` (funciona para IPs publicos e DNS)
2. **Tentativa 2 (fallback)**: Se falhar (IP privado), usar os IPs dos atacantes que tentaram auth no firewall (`topAuthCountriesFailed` ou `topCountries` do snapshot) para inferir a regiao - porem isso nao da a posicao do firewall
3. **Melhor fallback**: Usar o IP do **agent** que se conecta ao Supabase - o heartbeat do agent e feito de dentro da rede do cliente, passando pelo mesmo IP publico do firewall

**Abordagem escolhida**: Como nao temos o IP do agent armazenado, a solucao mais pratica e:
- Detectar se o hostname e IP privado (10.x, 172.16-31.x, 192.168.x)
- Se for privado, tentar buscar um IP publico alternativo da tabela `attack_surface_scans` ou das interfaces WAN do firewall que ja foram expandidas
- Se nenhum IP publico for encontrado, **nao mostrar** o ponto do firewall no mapa (comportamento graceful)

**Solucao simplificada e imediata**: Buscar os IPs publicos das interfaces WAN do firewall que ja estao na tabela de attack surface. Esses IPs sao publicos e podem ser geolocalizados.

## Detalhes tecnicos

### Arquivo: `src/pages/firewall/AnalyzerDashboardPage.tsx`

Alterar a logica de geolocalizacao (linhas 213-228):

**Antes:**
```text
hostname = new URL(fortigate_url).hostname
fetch ipwho.is/hostname -> pode falhar se IP privado
```

**Depois:**
```text
hostname = new URL(fortigate_url).hostname

// Verificar se e IP privado
if (isPrivateIP(hostname)):
  // Fallback: buscar IPs da attack_surface_scans para este firewall
  // Ou usar o primeiro IP publico das interfaces do firewall via API
  query attack_surface_scans WHERE firewall_id = X AND source = 'firewall' LIMIT 1
  hostname = primeiro IP publico encontrado

fetch ipwho.is/hostname
```

Porem a tabela `attack_surface_scans` pode nao existir. Alternativa mais robusta:

**Adicionar funcao helper `isPrivateIP`** que verifica ranges RFC1918:
- `10.0.0.0/8`
- `172.16.0.0/12`  
- `192.168.0.0/16`
- `127.0.0.0/8`

**Alterar a query `firewall-url`** para tambem buscar o `agent_id` do firewall, e entao buscar as tasks do agent que contenham IPs publicos do firewall (da colecao de interfaces).

**Melhor alternativa (mais simples)**: Verificar se o hostname e IP privado ou nao resolvivel, e nesse caso, tentar geolocalizacao via um IP dos atacantes mais frequentes que ja temos no snapshot - usando o pais com mais eventos como "regiao aproximada" do firewall (pois os ataques vem de fora, mas a localizacao do cliente pode ser inferida dos IPs de sucesso de auth).

**Solucao final escolhida - a mais limpa:**

1. Extrair hostname do `fortigate_url`
2. Se for IP privado, usar o **primeiro IP de auth success** do snapshot (IPs que logaram com sucesso provavelmente estao na mesma regiao do firewall) como fallback
3. Se nao houver auth success, usar `topAuthCountriesSuccess[0]` para posicionar o firewall no pais com mais logins bem-sucedidos

Na verdade, a forma mais direta: se `ipwho.is` falhar, pegar o primeiro IP de `topAuthIPsSuccess` (que sao IPs que autenticaram com sucesso - provavelmente da mesma rede/regiao do firewall) e geolocalizar esse IP.

### Mudancas concretas

**`src/pages/firewall/AnalyzerDashboardPage.tsx`:**

1. Adicionar funcao `isPrivateIP(ip)` que retorna true para RFC1918
2. Modificar a query `firewall-geo` para incluir fallback:
   - Se hostname e IP privado, verificar se ha IPs de auth success no snapshot
   - Se houver, usar o primeiro IP publico de auth success para geolocalizar
   - Se nao houver, tentar com o primeiro IP de `topAuthIPsFailed` (atacantes vem de fora, mas pelo menos mostra atividade)
3. Se nenhum fallback funcionar, o mapa mostra os pontos de ataque sem o firewall (comportamento atual)

### Fluxo da logica revisada

```text
1. Extrair hostname do fortigate_url
2. Se hostname e null -> sem geolocalizacao
3. Se hostname NAO e IP privado -> fetch ipwho.is/hostname (funciona para DNS e IPs publicos)
4. Se hostname E IP privado:
   a. Pegar topAuthIPsSuccess[0].ip do snapshot
   b. Se existir e for IP publico -> fetch ipwho.is/IP
   c. Se nao existir -> sem geolocalizacao (mapa fica sem o ponto do firewall)
```

### Arquivos modificados

1. `src/pages/firewall/AnalyzerDashboardPage.tsx` - adicionar isPrivateIP, modificar logica de geolocalizacao com fallback
