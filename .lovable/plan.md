
# Dois Fixes: Pulse Discreto + Filtro de Interfaces Tunnel

## Diagnóstico via Banco de Dados

Consultando os `task_step_results` da última tarefa `geo_query` do firewall BR-PNC-FW-001, o problema ficou claro:

**Interfaces com `role: wan`:**
| Interface | Type | IP |
|---|---|---|
| `wan1` (SIM) | physical | `186.233.96.14 255.255.255.252` ✅ |
| `wan2` (Infotel) | physical | `170.150.137.198 255.255.255.252` ✅ |
| `To_Azure-1` | **tunnel** | `0.0.0.0` ❌ |
| `To_Cambe-1` ... | **tunnel** | `0.0.0.0` ❌ |
| (26 mais túneis VPN) | **tunnel** | `0.0.0.0` ❌ |

O código atual filtra por `role === 'wan'`, `ip !== '0.0.0.0'` e `!isPrivateIP` — mas não exclui explicitamente `type === 'tunnel'`. As interfaces `wan1` e `wan2` **são** capturadas corretamente pelo filtro de IP.

O erro real foi na tarefa anterior (BR-LRV), que genuinamente não tem IPs públicos WAN. Para o BR-PNC, a task mais recente (`0f8d3ee8`) ainda era do LRV. O usuário clicou em "Buscar" para um **novo** firewall (BR-PNC) mas a task criada pode ter sido bloqueada por timeout/polling.

**Melhoria defensiva**: adicionar o filtro `type !== 'tunnel'` explicitamente para não depender do IP `0.0.0.0` como único excludente — afinal, um túnel IPIP ou GRE poderia ter IP público mas não ser a saída WAN real.

---

## Fix 1 — Pulse discreto no botão "Buscar"

### Problema
`animate-pulse-glow` aplica `box-shadow` pulsante ao redor do botão inteiro — visualmente muito agressivo.

### Solução
Substituir por um pequeno **ponto de notificação** (`animate-ping`) no canto superior direito do botão, sem nenhuma animação no botão em si. É o padrão de badge de notificação usado em apps modernos.

```tsx
<div className="relative inline-flex">
  {!geoLoading && formData.fortigate_url && formData.agent_id && (
    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 z-10">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
    </span>
  )}
  <Button
    disabled={geoLoading || !formData.fortigate_url || !formData.agent_id}
    // sem className de animação
  >
    ...Buscar
  </Button>
</div>
```

O botão fica estático; apenas um pequeno ponto verde pisca suavemente no canto. Muito mais elegante.

---

## Fix 2 — Filtro de interfaces tunnel

### Adição defensiva na extração de IPs WAN

```typescript
// ANTES
if (!isWan) continue;

// DEPOIS — pular túneis (VPN overlay, GRE, IPIP) que nunca têm o IP WAN real
if (!isWan) continue;
if (iface.type === 'tunnel' || iface.type === 'loopback') continue;
```

Isso garante que somente interfaces `physical`, `vlan`, `aggregate` (e similares) sejam consideradas para geolocalização — exatamente o que o FortiGate mostra na UI com as interfaces `SIM (wan1)` e `Infotel (wan2)`.

---

## Arquivo Modificado

| Arquivo | Operação |
|---|---|
| `src/pages/environment/AddFirewallPage.tsx` | Substituir `animate-pulse-glow` por dot indicator + adicionar filtro `type !== 'tunnel'` |

## Resultado Esperado

1. Botão "Buscar" com ponto de notificação verde discreto no canto
2. Interfaces `wan1` (`186.233.96.14`) e `wan2` (`170.150.137.198`) detectadas corretamente
3. Dialog de seleção de IPs WAN abre com as duas opções para escolha
