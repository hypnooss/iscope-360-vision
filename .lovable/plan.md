
# Conexões de Saída no Mapa: Azul (sucesso) e Vermelho (bloqueada)

## Situação Atual vs. O Que Você Quer

### Hoje o mapa tem:
| Cor | Significado | Direção |
|---|---|---|
| Vermelho | Tráfego negado **de entrada** (países que atacam o FW) | País → Firewall |
| Laranja | Falha de autenticação no FW | País → Firewall |
| Amarelo | Falha de autenticação VPN | País → Firewall |
| Verde | Sucesso de autenticação | País → Firewall |
| Azul-claro | Conexões de saída permitidas | Firewall → País |

### O Que Você Quer:
| Cor | Significado | Direção |
|---|---|---|
| 🔵 **Azul** | Conexões de saída **com sucesso** | Firewall → País destino |
| 🔴 **Vermelho** | Conexões de saída **bloqueadas** | Firewall → País destino |

O vermelho atual (tráfego de entrada negado, países que atacam o FW) é um conceito diferente e pode ser mantido ou removido do mapa — isso precisamos decidir. Pela sua mensagem, parece que o foco agora é exclusivamente nas **conexões de saída**. Proponho manter o tráfego de entrada (auth failures) nas cores laranja/amarelo/verde que já existem, e reservar vermelho + azul exclusivamente para saída.

---

## Causa Raiz: Falta da Métrica "Saída Bloqueada"

O backend atual (`analyzeOutboundTraffic`) já processa conexões de saída, mas filtra **apenas as permitidas** (action = accept). As conexões de saída **bloqueadas** (srcip privado → dstip público, action = deny) ainda não existem como métrica separada.

Na função `analyzeOutboundTraffic`, a linha que exclui logs bloqueados é:
```ts
if (action === 'deny' || action === 'block' || action === 'blocked') return false;
```
Precisamos processar esses logs bloqueados separadamente.

---

## Mudanças Necessárias

### 1. `src/types/analyzerInsights.ts` — Novo campo
Adicionar `topOutboundBlockedCountries` e `outboundBlocked` às métricas:
```ts
topOutboundBlockedIPs: TopBlockedIP[];
topOutboundBlockedCountries: TopCountry[];
outboundBlocked: number;
```

### 2. `supabase/functions/firewall-analyzer/index.ts` — Separar saída bloqueada
Dentro de `analyzeOutboundTraffic`, separar em dois grupos:
- `outboundAllowed`: srcip privado → dstip público, action = accept/allow/pass
- `outboundBlocked`: srcip privado → dstip público, action = deny/block

Gerar rankings separados `topOutboundBlockedIPs` e `topOutboundBlockedCountries`.

### 3. `src/hooks/useAnalyzerData.ts` — Expor novos campos
Adicionar `topOutboundBlockedIPs`, `topOutboundBlockedCountries`, `outboundBlocked` ao `parseSnapshot`.

### 4. `src/components/firewall/AttackMap.tsx` — Nova prop + nova cor
Adicionar a prop `outboundBlockedCountries` e usar vermelho `#ef4444` para ela (mesma cor atual de "denied"), mas com direção FW → país.

Simplificar a paleta de cores focada em saída:
```ts
const COLORS = {
  // Inbound auth (mantidos)
  fw_fail: '#f97316',      // Laranja — falha auth FW
  vpn_fail: '#eab308',     // Amarelo — falha auth VPN
  auth_success: '#22c55e', // Verde — sucesso auth
  // Saída (novo foco)
  outbound_ok: '#38bdf8',  // Azul — saída com sucesso (FW → destino)
  outbound_blocked: '#ef4444', // Vermelho — saída bloqueada (FW → destino)
};
```

Interface expandida:
```ts
interface AttackMapProps {
  outboundCountries?: TopCountry[];         // Saída com sucesso (azul)
  outboundBlockedCountries?: TopCountry[];  // Saída bloqueada (vermelho) — NOVO
  authFailedCountries: TopCountry[];        // Falha auth FW (laranja)
  authFailedVpnCountries?: TopCountry[];    // Falha auth VPN (amarelo)
  authSuccessCountries: TopCountry[];       // Sucesso auth (verde)
  // deniedCountries — pode ser mantido ou removido (tráfego de entrada negado)
  firewallLocation?: ...;
  fullscreen?: boolean;
}
```

A legenda no mapa será atualizada para refletir as 2 categorias de saída (azul/vermelho) com setas partindo do firewall.

### 5. `src/components/firewall/AttackMapFullscreen.tsx` — Painel de saída
Adicionar seção "Saída Bloqueada" no painel de estatísticas.

### 6. `src/pages/firewall/AnalyzerDashboardPage.tsx` — Passar nova prop
Passar `outboundBlockedCountries={m?.topOutboundBlockedCountries ?? []}` para o `AttackMap` e `AttackMapFullscreen`.

---

## Sobre o "Vermelho de Entrada" Atual

Atualmente o vermelho representa países que **enviaram tráfego negado ao firewall** (conexões de entrada bloqueadas). Com a mudança, o vermelho passará a representar **saída bloqueada** (FW → país destino).

Há duas opções:
- **Opção A (mais limpa):** Remover o "vermelho de entrada" do mapa — o mapa passa a mostrar apenas autenticações (laranja/amarelo/verde) e saída (azul/vermelho). O tráfego de entrada negado fica apenas nos widgets de tabela.
- **Opção B (mais completo):** Introduzir uma 6ª cor (ex: roxo `#a855f7`) para o tráfego de entrada negado, mantendo vermelho exclusivamente para saída bloqueada.

Recomendo a **Opção A** por simplicidade — o mapa fica focado nas conexões de saída e nas autenticações, que são os eventos mais acionáveis.

---

## Arquivos Modificados

| Arquivo | O que muda |
|---|---|
| `src/types/analyzerInsights.ts` | Adicionar `topOutboundBlockedIPs`, `topOutboundBlockedCountries`, `outboundBlocked` |
| `supabase/functions/firewall-analyzer/index.ts` | Separar saída em allowed vs blocked dentro de `analyzeOutboundTraffic` |
| `src/hooks/useAnalyzerData.ts` | Expor novos campos no parseSnapshot |
| `src/components/firewall/AttackMap.tsx` | Nova prop `outboundBlockedCountries`, vermelho = saída bloqueada (FW → país) |
| `src/components/firewall/AttackMapFullscreen.tsx` | Painel com saída bloqueada |
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Passar nova prop para AttackMap e AttackMapFullscreen |

A edge function precisará ser reimplantada após as mudanças, e uma nova análise deverá ser executada para popular os dados de saída bloqueada.
