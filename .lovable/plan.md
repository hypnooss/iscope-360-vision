

# Suporte a Firewalls em Cloud Publica (IP Publico Manual)

## Problema

Firewalls hospedados em clouds publicas (AWS, Azure, GCP) possuem apenas IPs privados nas interfaces WAN. Isso causa dois problemas:
- O botao "Buscar" (geolocalizacao) nao consegue resolver a localizacao porque descarta IPs privados
- O Surface Analyzer ignora esses firewalls ao coletar IPs para scan, pois filtra IPs privados

## Solucao

Adicionar um campo opcional `cloud_public_ip` na tabela `firewalls` e nas telas de cadastro/edicao. Abaixo do campo URL, um link discreto "Firewall em Cloud?" revela o campo para informar o IP publico real.

Esse IP sera utilizado como fallback tanto na geolocalizacao quanto no Surface Analyzer.

## Mudancas

### 1. Migration: novo campo na tabela firewalls

Adicionar coluna `cloud_public_ip` (text, nullable) na tabela `firewalls`.

### 2. Frontend: AddFirewallPage (Step 3 - Configuracao)

Abaixo do campo URL, adicionar um link clicavel com texto "Firewall em Cloud?" em estilo discreto (text-xs, text-muted-foreground, com icone de Cloud). Ao clicar, exibe um campo Input para o IP publico.

O campo sera salvo como `cloud_public_ip` no insert do firewall.

Na logica de geolocalizacao (botao Buscar), se o `cloud_public_ip` estiver preenchido, usar esse IP diretamente para consulta GeoIP em vez de extrair das interfaces WAN.

### 3. Frontend: FirewallEditPage

Mesma logica: link "Firewall em Cloud?" abaixo da URL, que revela o campo `cloud_public_ip`. Carregado do banco na inicializacao. Salvo no update.

Na logica do botao "Buscar", priorizar `cloud_public_ip` se preenchido.

### 4. Frontend: AddFirewallDialog

Mesma logica para o dialog de adicao rapida.

### 5. Backend: Surface Analyzer

No arquivo `supabase/functions/attack-surface-scan/index.ts`, na funcao `extractFirewallIPs` ou na secao que busca firewalls (linha ~789), verificar se o firewall tem `cloud_public_ip` preenchido. Se sim, incluir esse IP na lista de `source_ips` com label adequado (ex: "FW-Name - Cloud Public IP"), independente dos IPs das interfaces WAN.

### 6. Types

Atualizar `src/integrations/supabase/types.ts` com o novo campo.

## Detalhes tecnicos

### Link "Firewall em Cloud?"

```text
Abaixo do campo URL:
  [Cloud icon] Firewall em Cloud?    <- link discreto, text-xs
  
Ao clicar, revela:
  [Label: IP Publico da Cloud]
  [Input: Ex: 203.0.113.50]
  [texto explicativo: "Informe o IP publico atribuido pela cloud..."]
```

Estado controlado por um `useState<boolean>` (showCloudIP), inicializado como `true` se ja existir valor salvo.

### Geolocalizacao (Buscar)

Na logica do botao Buscar no AddFirewallPage e FirewallEditPage:
- Se `cloud_public_ip` estiver preenchido, fazer consulta GeoIP diretamente nesse IP (via edge function resolve-firewall-geo ou client-side ipwho.is)
- Pular a etapa de extrair IPs das interfaces WAN

### Surface Analyzer

No `attack-surface-scan/index.ts`, ao iterar firewalls:
- Se `cloud_public_ip` estiver preenchido e nao for IP privado, adicionar diretamente a lista de source_ips
- Manter a logica existente de extrair IPs das interfaces como fallback

### Arquivos afetados

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| Nova migration | Schema | Adicionar coluna `cloud_public_ip` em `firewalls` |
| `src/pages/environment/AddFirewallPage.tsx` | Frontend | Link "Firewall em Cloud?" + campo IP + ajuste no Buscar |
| `src/pages/firewall/FirewallEditPage.tsx` | Frontend | Mesma logica do AddFirewallPage |
| `src/components/firewall/AddFirewallDialog.tsx` | Frontend | Link + campo no dialog |
| `supabase/functions/attack-surface-scan/index.ts` | Backend | Incluir cloud_public_ip como source IP |
| `src/integrations/supabase/types.ts` | Types | Novo campo |

