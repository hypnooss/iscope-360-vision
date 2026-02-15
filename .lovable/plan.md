

# Fix: Geolocalizar Firewall usando IP publico da interface WAN

## Problema

O firewall BAU-FW esta cadastrado com IP interno (172.16.10.2), e a logica atual nao consegue geolocaliza-lo. Porem, o proprio firewall tem interfaces WAN com IPs publicos reais (187.32.89.65, 191.209.18.93) armazenados na tabela `task_step_results` (step `system_interface`).

## Solucao

Adicionar um novo passo de fallback **antes** dos fallbacks de auth IP: consultar a tabela `task_step_results` para extrair o primeiro IP publico de uma interface com `role: "wan"`.

Tambem corrigir a condicao `enabled` que atualmente exige `!!firewallHostname`, o que bloqueia a execucao quando o hostname e privado. A query deve rodar mesmo quando o hostname e privado (para usar os fallbacks).

## Detalhes tecnicos

### Arquivo: `src/pages/firewall/AnalyzerDashboardPage.tsx`

#### 1. Nova query para buscar IP publico WAN do firewall

Adicionar uma query separada (antes da query `firewall-geo-v2`) que busca o IP WAN:

```typescript
const { data: firewallWanIP } = useQuery({
  queryKey: ['firewall-wan-ip', selectedFirewall],
  queryFn: async () => {
    // Get most recent completed task for this firewall
    const { data: tasks } = await supabase
      .from('agent_tasks')
      .select('id')
      .eq('target_id', selectedFirewall)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);
    
    if (!tasks?.length) return null;

    const { data: stepResult } = await supabase
      .from('task_step_results')
      .select('data')
      .eq('task_id', tasks[0].id)
      .eq('step_id', 'system_interface')
      .limit(1)
      .single();

    if (!stepResult?.data?.results) return null;

    // Find first WAN interface with a public IP
    for (const iface of stepResult.data.results) {
      if (iface.role === 'wan' && iface.ip && iface.status === 'up') {
        const ipOnly = iface.ip.split(' ')[0]; // "187.32.89.65 255.255.255.240" -> "187.32.89.65"
        if (ipOnly && !isPrivateIP(ipOnly) && ipOnly !== '0.0.0.0') {
          return ipOnly;
        }
      }
    }
    return null;
  },
  enabled: !!selectedFirewall,
  staleTime: 1000 * 60 * 30,
});
```

#### 2. Integrar WAN IP na cadeia de fallback da query `firewall-geo-v2`

Adicionar `firewallWanIP` ao `queryKey` e como fallback prioritario (novo passo 2, antes dos auth IPs):

```typescript
queryKey: [
  'firewall-geo-v2',
  selectedFirewall,
  firewallHostname,
  firewallWanIP,  // NOVO
  snapshot?.metrics?.topAuthIPsSuccess?.[0]?.ip,
  snapshot?.metrics?.topAuthIPsFailed?.[0]?.ip,
],
```

Novo fallback entre o passo 1 (hostname/DNS) e o passo 2 atual (auth IPs):

```typescript
// 2. Fallback: WAN interface public IP from firewall config
if (firewallWanIP) {
  const result = await tryGeolocate(firewallWanIP);
  if (result) { console.log('[firewall-geo] wan-ip result:', result); return result; }
}
```

#### 3. Corrigir condicao `enabled`

Mudar de:
```typescript
enabled: !!firewallHostname && !!snapshot,
```

Para:
```typescript
enabled: !!selectedFirewall && !!snapshot,
```

Isso permite que a query rode mesmo quando o hostname e um IP privado (caso do BAU-FW), usando os fallbacks (WAN IP, auth IPs).

### Cadeia de fallback final

1. Hostname publico direto (IP ou DNS resolvido)
2. **IP publico da interface WAN** (novo)
3. Primeiro IP de auth bem-sucedida
4. Primeiro IP de auth com falha

