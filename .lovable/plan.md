
# Auth Firewall: Tabelas e Mapa de Ataques

## Situacao Atual

### Tabelas (OK - ja funcionam)
As tabelas "Top IPs - Auth Firewall" e "Top Paises - Auth Firewall" ja estao implementadas com abas Falhas/Sucessos, usando os dados separados `topFwAuthIPsFailed`, `topFwAuthIPsSuccess`, `topFwAuthCountriesFailed`, `topFwAuthCountriesSuccess`.

### Dados Reais (diagnostico)
O ultimo snapshot do ADM-FW mostra 351 falhas de FW auth, porem todos os IPs sao **privados** (172.20.10.172, 10.20.0.81 na porta 161 -- SNMP). IPs privados nao tem geolocalizacao, por isso `topFwAuthCountriesFailed` esta vazio. Isso e comportamento correto -- logins administrativos vindos da rede interna nao tem pais de origem. Tentativas externas (publicas) apareceriam com pais.

### Mapa (precisa de ajustes)
| Elemento | Cor Atual | Cor Solicitada |
|---|---|---|
| Falha Auth FW | Laranja (#f97316) | **Vermelho** |
| Sucesso Auth FW | Verde (#22c55e) - dados combinados FW+VPN | **Verde** - dados apenas FW |
| Saida Bloqueada | Vermelho (#ef4444) | Manter |

**Conflito de cor**: Falha Auth FW (vermelho) e Saida Bloqueada (vermelho) usariam a mesma cor. Para diferenciar, usaremos **vermelho escuro** (#dc2626) para Falha Auth FW e manteremos **vermelho claro** (#ef4444) para Saida Bloqueada. A direcao dos projeteis tambem ajuda: Auth vai Origem -> Firewall, Saida vai Firewall -> Destino.

## Mudancas Planejadas

### 1. AttackMap.tsx -- Ajustar cores
- Alterar `fw_fail` de `#f97316` (laranja) para `#dc2626` (vermelho escuro)
- Manter `outbound_blocked` como `#ef4444` (vermelho claro)

### 2. AnalyzerDashboardPage.tsx -- Passar dados FW-especificos
- Alterar `authSuccessCountries` de `m?.topAuthCountriesSuccess` (combinado FW+VPN) para `fwAuthCountriesSuccess` (apenas FW)
- Idem no fullscreen: separar totais de sucesso FW e VPN

### 3. AttackMapFullscreen.tsx -- Atualizar legenda
- Alterar a bolinha de "Falha Auth FW" de laranja para vermelho escuro (#dc2626)
- Separar "Sucesso Auth" em "Sucesso Auth FW" usando dados FW-especificos

## Detalhes Tecnicos

### Arquivo: `src/components/firewall/AttackMap.tsx`

**Paleta de cores (linha 24-30)**:
```
fw_fail: '#f97316'  -->  fw_fail: '#dc2626'  (vermelho escuro)
```

### Arquivo: `src/pages/firewall/AnalyzerDashboardPage.tsx`

**Dados do mapa (linha 495)**:
```
// ANTES: combinado FW + VPN
const authCountriesSuccess = m?.topAuthCountriesSuccess ?? [];

// DEPOIS: apenas FW
const authCountriesSuccess = fwAuthCountriesSuccess;
```

**Passagem de props ao AttackMap e AttackMapFullscreen**: usar `fwAuthCountriesSuccess` em vez de `authCountriesSuccess`.

### Arquivo: `src/components/firewall/AttackMapFullscreen.tsx`

**Legenda inferior (linha 176)**:
- Alterar cor da bolinha "Falha Auth FW" de `#f97316` para `#dc2626`
- Atualizar label "Sucesso Auth" para "Sucesso Auth FW"

## Resultado Visual no Mapa

| Camada | Cor | Direcao |
|---|---|---|
| Falha Auth FW | Vermelho escuro (#dc2626) | Pais Origem -> Firewall |
| Falha Auth VPN | Amarelo (#eab308) | Pais Origem -> Firewall |
| Sucesso Auth FW | Verde (#22c55e) | Pais Origem -> Firewall |
| Saida Permitida | Azul (#38bdf8) | Firewall -> Pais Destino |
| Saida Bloqueada | Vermelho claro (#ef4444) | Firewall -> Pais Destino |

## Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/components/firewall/AttackMap.tsx` | Alterar cor `fw_fail` de laranja para vermelho escuro |
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Passar dados FW-especificos para sucesso auth no mapa |
| `src/components/firewall/AttackMapFullscreen.tsx` | Atualizar cor e label na legenda inferior |
