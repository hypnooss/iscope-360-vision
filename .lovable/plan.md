

# Redesign do Analyzer Dashboard + Mapa de Ataques com Firewall e Conexoes

## Resumo das alteracoes

1. Remover o bloco "Score de Risco"
2. Adicionar info de ultima analise no header
3. Subir o "Resumo de Eventos" para antes do grid de widgets
4. Mapa de Ataques sempre visivel (sem toggle), com o Firewall plotado e animacoes de conexao
5. Resolver IP ou hostname do Firewall para geolocalizacao

## Detalhes tecnicos

### Arquivo 1: `src/pages/firewall/AnalyzerDashboardPage.tsx`

**Remover:**
- Bloco "Score de Risco" (linhas 284-297)
- Toggle do mapa (linhas 317-323) e condicional `showMap` (linha 325)
- Estado `showMap`

**Adicionar no header:**
- Linha informativa com data da ultima analise (`snapshot.created_at`) formatada, e periodo analisado se disponivel
- Badge de status

**Buscar `fortigate_url` do firewall selecionado:**
- Adicionar query para buscar `fortigate_url` da tabela `firewalls` pelo `selectedFirewall`
- Extrair hostname/IP do URL: `new URL(fortigate_url).hostname`
- Usar `useQuery` para chamar `http://ip-api.com/json/{hostname}?fields=status,lat,lon` com `staleTime` de 30 minutos
- A API `ip-api.com` aceita tanto IPs (`200.189.174.210`) quanto hostnames DNS (`fw.empresa.com`) e resolve automaticamente
- Passar coordenadas resultantes como prop `firewallLocation` para `AttackMap`

**Reordenar layout:**
1. Header + info ultima analise
2. Severity Cards
3. Resumo de Eventos (full-width, movido para fora do grid)
4. Mapa de Ataques (sempre visivel, sem toggle)
5. Grid de widgets (Top IPs, Top Paises, Auth, Web Filter, App Control, Anomalias, Insights)

### Arquivo 2: `src/components/firewall/AttackMap.tsx`

**Nova prop:**
```
firewallLocation?: { lat: number; lng: number; label: string }
```

**Plotar o Firewall no mapa:**
- Ponto ciano (`#06b6d4`) com icone shield diferenciado
- Label "Firewall" visivel permanentemente
- Pulso animado como os outros pontos

**Linhas animadas de conexao:**
- Para cada ponto de ataque, desenhar uma linha SVG ate o ponto do firewall
- Cor da linha herda o tipo (vermelho, laranja, verde)
- Opacidade baixa (0.12-0.18)
- Animacao de fluxo com `stroke-dasharray` e `stroke-dashoffset` animado:
  ```xml
  <line stroke-dasharray="6 4" opacity="0.15">
    <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.5s" repeatCount="indefinite" />
  </line>
  ```

**Atualizar legenda** para incluir o Firewall (ponto ciano)

### Resolucao de DNS

A API `ip-api.com` resolve hostnames automaticamente. Exemplo:
- Input: `https://fw.empresa.com:8443` -> hostname: `fw.empresa.com`
- API call: `http://ip-api.com/json/fw.empresa.com?fields=status,lat,lon`
- Resposta: `{ "status": "success", "lat": -22.9, "lon": -43.2 }`

Nao e necessario resolver DNS separadamente — a API faz tudo.

### Arquivos modificados

1. `src/pages/firewall/AnalyzerDashboardPage.tsx` - layout, query firewall URL, geolocalizacao
2. `src/components/firewall/AttackMap.tsx` - ponto do firewall, linhas animadas, legenda

