
# Separação de Autenticação VPN/Firewall e Conexões de Saída no Analyzer

## Análise da Situação Atual

### O que já existe (dados separados, UI parcialmente separada)
O backend (`firewall-analyzer` edge function) **já separa** corretamente:
- `firewallAuthFailures` / `firewallAuthSuccesses` — logins na interface administrativa
- `vpnFailures` / `vpnSuccesses` — autenticações VPN

Os rankings já existem: `topAuthIPsFailed`, `topAuthIPsSuccess`, `topAuthCountriesFailed`, `topAuthCountriesSuccess`.

### O que está faltando

**1. Dashboard (AnalyzerDashboardPage.tsx)**
- O card "Resumo de Eventos" agrupa Login Firewall (falha) e VPN (falha) sem mostrar os sucessos separadamente
- Os widgets "Top IPs - Autenticação" e "Top Países - Autenticação" mostram apenas uma divisão Falha/Sucesso combinada (sem separar VPN de Firewall)
- Não existe widget de "Conexões de Saída" (tráfego gerado pelo firewall ou dispositivos internos)

**2. Mapa de Ataques (AttackMap + AttackMapFullscreen)**
- Atualmente usa apenas 3 cores: vermelho (negado), laranja (falha auth combinada), verde (sucesso auth combinado)
- VPN e Firewall auth estão misturados em uma única camada laranja/verde
- Painel inferior da tela cheia combina `firewallAuthFailures + vpnFailures` em um único número

**3. Tipos (analyzerInsights.ts) e métricas**
- Não existe campos para `topOutboundIPs`, `topOutboundCountries`, `outboundConnections` nas métricas

---

## Mudanças Planejadas

### 1. `src/types/analyzerInsights.ts` — Adicionar métricas de saída

```ts
// Novos campos em AnalyzerMetrics:
topOutboundIPs: TopBlockedIP[];       // IPs de destino de conexões de saída
topOutboundCountries: TopCountry[];   // Países de destino de conexões de saída  
outboundConnections: number;          // Total de conexões de saída permitidas
```

### 2. `supabase/functions/firewall-analyzer/index.ts` — Análise de tráfego de saída

Adicionar nova função `analyzeOutboundTraffic(logs)` que processa logs de tráfego **permitido** com direção de saída:

```ts
function analyzeOutboundTraffic(logs: any[]): { insights, metrics }
```
- Filtra logs where `srcip` é privado (10.x, 192.168.x, 172.16-31.x) e `dstip` é público
- Também captura logs where `direction` é `outbound`
- Coleta Top IPs destino, Top países destino, total de conexões
- Gera insights para conexões a países incomuns ou volume alto para um único destino

Integrar no `raw_data.allowed_traffic` (dados já coletados pelo blueprint `forward_traffic` com `action=accept`).

### 3. `src/hooks/useAnalyzerData.ts` — Expor métricas de saída

Adicionar `topOutboundIPs`, `topOutboundCountries`, `outboundConnections` ao `parseSnapshot`.

### 4. `src/pages/firewall/AnalyzerDashboardPage.tsx` — UI separada

#### 4a. Resumo de Eventos (Seção de Cards)
Expandir a grade de 8 para 10 estatísticas com separação explícita:

| Antes | Depois |
|---|---|
| "Login Firewall" (apenas falhas) | "Login Firewall" com falhas + tooltip de sucesso |
| "Falhas VPN" | "VPN Auth" com falhas + tooltip de sucesso |
| — | "Conexões de Saída" (novo) |

Os cards de autenticação ganham um sub-label colorido: `🔴 X falhas / 🟢 Y sucessos`.

#### 4b. Novos widgets — Autenticação separada por origem

Substituir os dois widgets de "Top IPs - Autenticação" e "Top Países - Autenticação" por **quatro widgets** separados:

```
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  Top IPs - Auth Firewall     │  │  Top Países - Auth Firewall  │
│  [Tabs: Falhas | Sucessos]   │  │  [Tabs: Falhas | Sucessos]   │
└──────────────────────────────┘  └──────────────────────────────┘
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  Top IPs - Auth VPN          │  │  Top Países - Auth VPN       │
│  [Tabs: Falhas | Sucessos]   │  │  [Tabs: Falhas | Sucessos]   │
└──────────────────────────────┘  └──────────────────────────────┘
```

Para isso, o `analyzeAuthentication` na edge function precisará expor também:
- `topFwAuthIPsFailed` / `topFwAuthIPsSuccess`
- `topVpnAuthIPsFailed` / `topVpnAuthIPsSuccess`
- `topFwAuthCountriesFailed` / `topFwAuthCountriesSuccess`
- `topVpnAuthCountriesFailed` / `topVpnAuthCountriesSuccess`

#### 4c. Novo widget — Conexões de Saída

```
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  Top IPs Destino (Saída)     │  │  Top Países Destino (Saída)  │
└──────────────────────────────┘  └──────────────────────────────┘
```

### 5. `src/components/firewall/AttackMap.tsx` — 5 camadas de cor

| Camada | Tipo | Cor |
|---|---|---|
| Vermelho `#ef4444` | Tráfego Negado (entrada) | Existente |
| Laranja `#f97316` | Falha Auth Firewall | Existente (renomear) |
| Amarelo `#eab308` | Falha Auth VPN | **Novo** |
| Verde `#22c55e` | Sucesso Auth | Existente |
| Azul-claro `#38bdf8` | Conexões de Saída | **Novo** (direção invertida: FW → destino) |

**Direção dos projéteis invertida para saída:**
- Conexões de entrada (denied, auth fail/success): origem → firewall (atual)
- Conexões de saída: firewall → destino (novo — inverter `from` e `to` no `animateMotion`)

Interface `AttackMapProps` expandida:
```ts
interface AttackMapProps {
  deniedCountries: TopCountry[];
  authFailedFwCountries: TopCountry[];     // renomear authFailedCountries
  authFailedVpnCountries: TopCountry[];    // NOVO
  authSuccessCountries: TopCountry[];
  outboundCountries: TopCountry[];         // NOVO
  firewallLocation?: ...;
  fullscreen?: boolean;
}
```

### 6. `src/components/firewall/AttackMapFullscreen.tsx` — Painel lateral expandido

- Separar o painel inferior em 5 métricas (remover a soma `firewallAuthFailures + vpnFailures`)
- Adicionar seção "Top Países Destino (Saída)" ao painel direito
- Legenda expandida com as 5 cores

### 7. `src/hooks/useAnalyzerData.ts` — Novos campos no parseSnapshot

Adicionar ao parseSnapshot:
- `topFwAuthIPsFailed`, `topFwAuthIPsSuccess`
- `topVpnAuthIPsFailed`, `topVpnAuthIPsSuccess`
- `topFwAuthCountriesFailed`, `topFwAuthCountriesSuccess`
- `topVpnAuthCountriesFailed`, `topVpnAuthCountriesSuccess`
- `topOutboundIPs`, `topOutboundCountries`, `outboundConnections`

---

## Arquivos Modificados

1. `src/types/analyzerInsights.ts` — novos campos em `AnalyzerMetrics`
2. `supabase/functions/firewall-analyzer/index.ts` — separação VPN/FW por origem e análise de saída
3. `src/hooks/useAnalyzerData.ts` — expor novos campos no parseSnapshot
4. `src/pages/firewall/AnalyzerDashboardPage.tsx` — UI com separação visual e novos widgets
5. `src/components/firewall/AttackMap.tsx` — 5 camadas de cor + direção invertida para saída
6. `src/components/firewall/AttackMapFullscreen.tsx` — painel atualizado

## Observação sobre Dados de Saída

O blueprint do FortiGate já coleta logs de `forward_traffic`. Os logs com `action=accept` e `srcip` privado representam conexões de saída de dispositivos internos. A nova função `analyzeOutboundTraffic` apenas precisa filtrar esses dados que já chegam via `raw_data.allowed_traffic` (ou do próprio `raw_data.forward_traffic`). Se esse campo não existir no blueprint atual, usaremos `denied_traffic` invertido (logs do tipo accept no mesmo endpoint) — não requer mudança no agente.
