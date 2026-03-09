

# Adicionar Top IPs nos Cards de Tráfego

## O que será feito

Adicionar uma seção compacta de **Top IPs de Origem** no card **Tráfego de Saída** e **Top IPs de Destino** no card **Tráfego de Entrada**, diretamente no grid de categorias (`AnalyzerCategoryGrid.tsx`).

## Dados disponíveis

Os dados já existem nas métricas do snapshot:
- **Saída (Top IPs de Origem)**: `metrics.topOutboundIPs` + `metrics.topOutboundBlockedIPs` — IPs internos que mais geraram tráfego de saída
- **Entrada (Top IPs de Destino)**: `metrics.topInboundBlockedIPs` + `metrics.topInboundAllowedIPs` — IPs de destino mais acessados no tráfego de entrada

Tipo `TopBlockedIP`: `{ ip, country?, count, targetPorts[] }`

## Alteração

**Arquivo**: `src/components/firewall/AnalyzerCategoryGrid.tsx`

1. No `getCategoryStats`, para `inbound_traffic` retornar também `topIPs: metrics.topInboundAllowedIPs?.slice(0, 3)` e para `outbound_traffic` retornar `topIPs: metrics.topOutboundIPs?.slice(0, 3)`

2. No render do card, para as categorias `inbound_traffic` e `outbound_traffic`, adicionar após os badges uma mini-lista dos top 3 IPs com contagem, exibidos como pequenos itens compactos (IP + count) com label "Top IPs de Destino" ou "Top IPs de Origem" conforme a categoria

3. Estilo: texto `text-[10px]` monospace para IPs, contagem à direita, fundo `bg-secondary/30` com padding mínimo — mantendo o card compacto

