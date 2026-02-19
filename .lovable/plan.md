

# Adicionar Auth VPN (Sucesso + Falha) ao Mapa de Ataques

## Situacao Atual

| Camada | Cor | Status |
|---|---|---|
| Falha Auth FW | Vermelho escuro (#dc2626) | OK no mapa |
| Falha Auth VPN | Amarelo (#eab308) | No mapa, mas usuario quer **laranja** |
| Sucesso Auth FW | Verde (#22c55e) | OK no mapa |
| **Sucesso Auth VPN** | -- | **NAO esta no mapa** |

O `authSuccessCountries` recebe apenas `fwAuthCountriesSuccess` (linha 495 do AnalyzerDashboardPage). Os dados de `vpnAuthCountriesSuccess` existem mas nao sao passados ao mapa.

## Mudancas Planejadas

### 1. AttackMap.tsx -- Nova prop + cor laranja

- Adicionar prop `authSuccessVpnCountries?: TopCountry[]` para VPN success (verde no mapa, camada separada)
- Alterar `vpn_fail` de `#eab308` (amarelo) para `#f97316` (laranja)
- No `inboundPoints`, adicionar `addPoints(authSuccessVpnCountries, COLORS.auth_success, 'Sucesso Auth VPN')`
- Na legenda inline (modo nao-fullscreen), adicionar bullet "Sucesso Auth VPN" (verde) e alterar "Falha Auth VPN" para laranja

### 2. AnalyzerDashboardPage.tsx -- Passar dados VPN success

- Passar `authSuccessVpnCountries={vpnAuthCountriesSuccess}` ao AttackMap e AttackMapFullscreen
- Separar `totalAuthSuccess` em `totalFwAuthSuccess` e `totalVpnAuthSuccess` para o painel fullscreen

### 3. AttackMapFullscreen.tsx -- Nova secao + cor laranja

- Adicionar prop `authSuccessVpnCountries?: TopCountry[]` e `totalVpnAuthSuccess?: number`
- Adicionar secao "Sucesso Auth VPN" (verde) no painel lateral
- Alterar cor "Falha Auth VPN" de `#eab308` para `#f97316` (laranja)
- Atualizar barra inferior com os mesmos ajustes

## Paleta Final do Mapa

| Camada | Cor | Direcao |
|---|---|---|
| Falha Auth FW | Vermelho escuro (#dc2626) | Pais Origem -> Firewall |
| Falha Auth VPN | **Laranja (#f97316)** | Pais Origem -> Firewall |
| Sucesso Auth FW | Verde (#22c55e) | Pais Origem -> Firewall |
| **Sucesso Auth VPN** | **Verde (#22c55e)** | Pais Origem -> Firewall |
| Saida Permitida | Azul (#38bdf8) | Firewall -> Pais Destino |
| Saida Bloqueada | Vermelho claro (#ef4444) | Firewall -> Pais Destino |

Nota: Sucesso Auth FW e VPN usam a mesma cor verde no mapa, mas aparecem como secoes separadas no painel lateral com contagens independentes.

## Detalhes Tecnicos

### AttackMap.tsx

```
// Paleta atualizada
COLORS.vpn_fail: '#eab308' --> '#f97316'  (laranja)

// Interface - nova prop
authSuccessVpnCountries?: TopCountry[];

// inboundPoints - adicionar
addPoints(authSuccessVpnCountries, COLORS.auth_success, 'Sucesso Auth VPN');

// Glow do projetil VPN fail: trocar de yellow para orange
p.color === COLORS.vpn_fail ? 'url(#lf-glow-orange)' ...
```

### AnalyzerDashboardPage.tsx

```
// Passar ao AttackMap e AttackMapFullscreen:
authSuccessVpnCountries={vpnAuthCountriesSuccess}
totalFwAuthSuccess={m?.firewallAuthSuccesses ?? 0}
totalVpnAuthSuccess={m?.vpnSuccesses ?? 0}
```

### AttackMapFullscreen.tsx

```
// Nova prop
authSuccessVpnCountries?: TopCountry[];
totalFwAuthSuccess?: number;
totalVpnAuthSuccess?: number;

// Secoes atualizadas:
{ label: 'Falha Auth VPN', color: '#f97316', ... }
{ label: 'Sucesso Auth FW', color: '#22c55e', countries: authSuccessCountries, total: totalFwAuthSuccess }
{ label: 'Sucesso Auth VPN', color: '#22c55e', countries: authSuccessVpnCountries, total: totalVpnAuthSuccess }
```

## Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/components/firewall/AttackMap.tsx` | Nova prop VPN success + cor laranja para VPN fail |
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Passar dados VPN success e totais separados |
| `src/components/firewall/AttackMapFullscreen.tsx` | Nova secao VPN success + cor laranja + totais separados |
