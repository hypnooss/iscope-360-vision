
# Plano: Corrigir Uptime, Cor do Alerta e Dismissal

## Resumo dos Problemas

| Problema | Causa Raiz |
|----------|------------|
| **Uptime: N/A** | O código procura `results.uptime` como número, mas o endpoint retorna `utc_last_reboot` e `snapshot_utc_time` em milissegundos |
| **Alerta âmbar** | Severidade é calculada dinamicamente pelo score. Usuário quer verde/teal para análises concluídas |
| **Alerta reaparece** | Query não filtra alertas já dispensados pelo usuário atual |

---

## Problema 1: Uptime N/A

### Dados Reais Encontrados

```json
{
  "utc_last_reboot": 1759432739000,
  "snapshot_utc_time": 1769286349000
}
```

Cálculo: `(1769286349000 - 1759432739000) / 1000 = 9,853,610 segundos ≈ 114 dias`

### Correção

**Arquivo:** `supabase/functions/agent-task-result/index.ts` (linhas 267-288)

Alterar a lógica de extração de uptime para calcular a partir dos timestamps:

```typescript
// Try to get uptime from webui_state endpoint
const webuiState = rawData['webui_state'] as Record<string, unknown> | undefined;
if (webuiState?.results) {
  const results = webuiState.results as Record<string, unknown>;
  
  // Calculate uptime from utc_last_reboot and snapshot_utc_time (both in milliseconds)
  const lastReboot = results.utc_last_reboot as number | undefined;
  const snapshotTime = results.snapshot_utc_time as number | undefined;
  
  if (typeof lastReboot === 'number' && typeof snapshotTime === 'number') {
    const uptimeSec = Math.floor((snapshotTime - lastReboot) / 1000);
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    systemInfo.uptime = days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
  }
  
  // Also get serial/hostname from here if not already set
  if (!systemInfo.serial && results.serial) {
    systemInfo.serial = results.serial;
  }
  if (!systemInfo.hostname && results.hostname) {
    systemInfo.hostname = results.hostname;
  }
}
```

---

## Problema 2: Cor do Alerta (Âmbar para Verde)

### Situação Atual
- Severidade calculada dinamicamente: score >= 70 = info (azul), 50-69 = warning (âmbar), < 50 = error (vermelho)
- O usuário quer **verde/teal** para alertas de análise concluída independente do score

### Correção em Duas Partes

#### 2.1 Backend: Usar severidade `success` para análises concluídas

**Arquivo:** `supabase/functions/agent-task-result/index.ts` (linha 631)

```typescript
// Create system alert for analysis completion
// Use 'success' for completed analyses, regardless of score
await supabase
  .from('system_alerts')
  .insert({
    alert_type: 'firewall_analysis_completed',
    title: 'Análise Concluída',
    message: `A análise do firewall "${firewallName}" foi concluída com score ${score}%.`,
    severity: 'success',  // Sempre verde para análises concluídas
    // ...resto igual
  });
```

#### 2.2 Frontend: Adicionar estilo verde para `success`

**Arquivo:** `src/components/alerts/SystemAlertBanner.tsx` (linhas 93-111)

```typescript
const getSeverityStyles = (severity: string) => {
  switch (severity) {
    case 'error':
      return {
        container: 'bg-destructive/10 border-destructive/30 text-destructive',
        icon: AlertCircle,
      };
    case 'warning':
      return {
        container: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400',
        icon: AlertTriangle,
      };
    case 'success':
      return {
        container: 'bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400',
        icon: Shield,  // Usar Shield para análises
      };
    default: // info
      return {
        container: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
        icon: Info,
      };
  }
};
```

---

## Problema 3: Alerta Reaparecendo

### Situação Atual
- Quando o usuário clica em X, o ID é adicionado ao `dismissed_by[]` no banco
- Mas a query `fetchActiveAlerts` não filtra por isso
- O usuário também é adicionado ao `dismissedLocally`, mas ao recarregar a página, esse estado é perdido

### Correção: Filtrar alertas dispensados no fetch

**Arquivo:** `src/components/alerts/SystemAlertBanner.tsx` (linhas 29-52)

A filtragem precisa ser feita no cliente, pois Supabase não suporta `NOT contains` em arrays diretamente:

```typescript
const fetchActiveAlerts = async () => {
  try {
    const { data, error } = await supabase
      .from('system_alerts')
      .select('id, alert_type, title, message, severity, metadata, created_at, dismissed_by')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching alerts:', error);
      return;
    }

    // Filtrar alertas já dispensados pelo usuário atual
    const filteredData = (data || []).filter(alert => {
      const dismissedBy = alert.dismissed_by || [];
      return !dismissedBy.includes(user?.id);
    });

    // Ordenar por severidade (error > warning > success > info)
    const sortedData = filteredData.sort((a, b) => {
      const severityOrder: Record<string, number> = { 
        error: 0, 
        warning: 1, 
        success: 2, 
        info: 3 
      };
      return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
    });

    setAlerts(sortedData as SystemAlert[]);
  } catch (error) {
    console.error('Error fetching alerts:', error);
  }
};
```

Também atualizar a interface para incluir `dismissed_by`:

```typescript
interface SystemAlert {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  severity: string;
  metadata: Record<string, unknown>;
  created_at: string;
  dismissed_by?: string[];  // Adicionar campo
}
```

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-task-result/index.ts` | Calcular uptime de timestamps + severidade `success` |
| `src/components/alerts/SystemAlertBanner.tsx` | Estilo teal + filtrar alertas dispensados |

---

## Fluxo Após Correções

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Uptime Corrigido                            │
├─────────────────────────────────────────────────────────────────┤
│  webui_state.results.utc_last_reboot = 1759432739000            │
│  webui_state.results.snapshot_utc_time = 1769286349000          │
│                                                                 │
│  uptime = (1769286349000 - 1759432739000) / 1000                │
│         = 9,853,610 segundos                                    │
│         = 114d 1h 46m                                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Alerta Verde/Teal                           │
├─────────────────────────────────────────────────────────────────┤
│  severity: 'success'                                            │
│  container: 'bg-teal-500/10 border-teal-500/30 text-teal-600'   │
│  icon: Shield                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Dismissal Persistente                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Usuário clica em X                                          │
│  2. User ID é salvo em dismissed_by[] no banco                  │
│  3. Ao recarregar, fetchActiveAlerts filtra alertas             │
│     onde dismissed_by contém o user.id                          │
│  4. Alerta não reaparece                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Observação Importante

Uma **nova análise** será necessária para ver o uptime corrigido no dashboard. Os alertas atuais continuarão âmbar até que uma nova análise seja executada.
