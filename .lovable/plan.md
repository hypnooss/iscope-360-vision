
# Botão "Buscar" com Inteligência — FirewallEditPage

## Ideia aprovada

A abordagem sugerida é excelente e tecnicamente viável. Os dados de `system_interface` e `system_sdwan` já estão presentes nas coletas de compliance armazenadas em `task_step_results`. Isso significa que, na maioria dos casos, o botão pode responder instantaneamente — sem precisar esperar o Agent.

## Diagnóstico dos dados disponíveis

Os step results das coletas `fortigate_compliance` incluem:
- `system_interface` — array completo de todas as interfaces, com campos `ip`, `name`, `role`, `type`
- `system_sdwan` — configuração SD-WAN, com `members` (lista de interfaces WAN)

Ambos os steps têm exatamente a mesma estrutura que o fluxo atual do Agent usa para identificar IPs WAN públicos — ou seja, o mesmo algoritmo de filtragem pode ser reutilizado.

## Lógica do novo fluxo

```text
Usuário clica "Buscar"
        |
        v
Existe task_step_results de fortigate_compliance
para este firewall_id com step_id IN ('system_interface', 'system_sdwan')
e status = 'success' nos últimos 7 dias ?
        |
   SIM  |  NÃO
        |
   Extrair IPs         Criar task via Agent
   WAN dos steps       (fluxo atual)
   locais (< 1s)
        |
   Chamar resolve-firewall-geo
   com { ips: [...] }
        |
   Mostrar resultado / WanSelectorDialog
```

## Implementação técnica

### `src/pages/firewall/FirewallEditPage.tsx`

**1. Novo estado de controle:**
```tsx
const [geoSource, setGeoSource] = useState<'cache' | 'agent' | null>(null);
```

**2. Novo handler do botão "Buscar" — lógica com dois caminhos:**

```tsx
const handleBuscar = async () => {
  if (!formData.fortigate_url) { toast.error('Preencha a URL primeiro'); return; }
  if (!formData.agent_id) { toast.error('Selecione um Agent primeiro'); return; }

  setGeoLoading(true);
  setGeoSource(null);

  try {
    // ── CAMINHO 1: Verificar coletas de compliance recentes ─────────────
    // Buscar a task de compliance mais recente para este firewall
    const { data: recentTask } = await supabase
      .from('agent_tasks')
      .select('id')
      .eq('target_id', id)           // firewall_id
      .eq('target_type', 'firewall')
      .eq('task_type', 'fortigate_compliance')
      .eq('status', 'completed')
      .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentTask?.id) {
      // Buscar os step results de interface e sdwan
      const { data: stepRows } = await supabase
        .from('task_step_results')
        .select('step_id, data, status')
        .eq('task_id', recentTask.id)
        .in('step_id', ['system_interface', 'system_sdwan'])
        .eq('status', 'success');

      const stepMap = Object.fromEntries(
        (stepRows || []).map(r => [r.step_id, r.data])
      );

      const interfacesData = stepMap['system_interface'];
      const sdwanData = stepMap['system_sdwan'];

      if (interfacesData) {
        // Mesmo algoritmo de filtragem WAN já existente na página
        const wanIPs = extractWanPublicIPs(interfacesData, sdwanData);

        if (wanIPs.length > 0) {
          // Geolocalizar via Edge Function (server-side, sem CORS)
          const { data: geoData } = await supabase.functions.invoke('resolve-firewall-geo', {
            body: { ips: wanIPs.map(w => w.ip) },
          });
          // ... processar e mostrar resultado igual ao fluxo atual
          setGeoSource('cache');
          toast.success('📦 Localização obtida da última coleta de compliance');
          setGeoLoading(false);
          return;
        }
      }
    }

    // ── CAMINHO 2: Fallback — criar task via Agent ──────────────────────
    setGeoSource('agent');
    toast.info('Nenhuma coleta recente encontrada. Aguardando resposta do Agent...');
    // ... fluxo atual com resolve-firewall-geo + polling
  } catch (err) {
    toast.error('Erro: ' + err.message);
    setGeoLoading(false);
  }
};
```

**3. Extrair o algoritmo de filtragem WAN para uma função local reutilizável:**

```tsx
function extractWanPublicIPs(
  interfacesData: any,
  sdwanData: any
): { ip: string; interfaceName: string }[] {
  const isPrivateIP = (ip: string) =>
    /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/.test(ip);
  const looksLikeIP = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
  const wanNamePatterns = /^(wan|wan\d+|internet|isp|isp\d+|mpls|lte|4g|5g|broadband)/i;

  const interfaces: any[] = interfacesData?.results || interfacesData?.data?.results || [];
  const sdwan = sdwanData?.results || sdwanData?.data?.results || {};
  const sdwanMembers = new Set<string>(
    (sdwan.members || []).map((m: any) => m.interface).filter(Boolean)
  );

  const wanIPs: { ip: string; interfaceName: string }[] = [];
  for (const iface of interfaces) {
    let isWan = false;
    if (iface.name === 'virtual-wan-link') isWan = true;
    else if (sdwanMembers.has(iface.name)) isWan = true;
    else if (iface.role?.toLowerCase() === 'wan') isWan = true;
    else if (wanNamePatterns.test(iface.name)) isWan = true;
    if (!isWan) continue;
    if (iface.type === 'tunnel' || iface.type === 'loopback') continue;
    const ipField: string = iface.ip || '';
    const ip = ipField.split(' ')[0];
    if (looksLikeIP(ip) && !isPrivateIP(ip) && ip !== '0.0.0.0') {
      wanIPs.push({ ip, interfaceName: iface.name });
    }
  }
  return wanIPs;
}
```

**4. Indicador visual da fonte:**

Mostrar uma badge pequena no toast para indicar se veio do cache ou do Agent:
- Cache: `📦 Localização obtida da última coleta (DD/MM/YYYY HH:mm)`
- Agent: `🔌 Localização obtida diretamente do FortiGate`

## Benefícios

| Cenário | Tempo antes | Tempo depois |
|---|---|---|
| Firewall com coleta recente (< 7 dias) | 15–60s (polling Agent) | < 1s (banco local) |
| Firewall sem coleta recente | 15–60s | 15–60s (mesmo fluxo) |
| Agent offline | Timeout 60s | < 1s (se tiver cache) |

O sistema se torna muito mais inteligente: usa dados já coletados quando possível e cria a task apenas como último recurso.

## Arquivo modificado

- `src/pages/firewall/FirewallEditPage.tsx`
