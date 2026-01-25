
# Plano: Alertas em Tempo Real e Fechamento do Banner

## Problemas Identificados

1. **Alertas não aparecem automaticamente**: O banner só busca alertas no `useEffect` inicial quando o componente monta. Não há subscription para eventos realtime.

2. **Botão "Ver Análise" não fecha o banner**: O link apenas redireciona, mas não dispensa o alerta.

---

## Alterações Necessárias

### 1. Habilitar Realtime na Tabela `system_alerts`

Criar migration SQL para adicionar a tabela ao realtime:

```sql
-- Habilitar realtime para system_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_alerts;
```

---

### 2. Atualizar `SystemAlertBanner.tsx`

#### Mudança A: Adicionar Realtime Subscription (após linha 28)

```typescript
// Subscription para alertas em tempo real
useEffect(() => {
  if (role !== 'super_admin' && role !== 'workspace_admin') return;

  const channel = supabase
    .channel('system_alerts_changes')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'system_alerts'
      },
      (payload) => {
        console.log('Alert change detected:', payload);
        // Re-fetch alertas quando houver mudança
        fetchActiveAlerts();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [role, user?.id]);
```

#### Mudança B: Transformar botão "Ver Análise" em handler (linhas 186-198)

```typescript
// ANTES
{primaryAlert.alert_type === 'firewall_analysis_completed' && 
 (primaryAlert.metadata as Record<string, unknown>)?.firewall_id && (
  <Button
    variant="outline"
    size="sm"
    className={cn("h-8 px-4 text-xs font-medium", styles.buttonClass)}
    asChild
  >
    <Link to={`/scope-firewall/firewalls/${...}/analysis`}>
      Ver Análise
    </Link>
  </Button>
)}

// DEPOIS
{primaryAlert.alert_type === 'firewall_analysis_completed' && 
 (primaryAlert.metadata as Record<string, unknown>)?.firewall_id && (
  <Button
    variant="outline"
    size="sm"
    className={cn("h-8 px-4 text-xs font-medium", styles.buttonClass)}
    onClick={() => handleViewAnalysis(
      primaryAlert.id, 
      (primaryAlert.metadata as Record<string, unknown>).firewall_id as string
    )}
  >
    Ver Análise
  </Button>
)}
```

#### Mudança C: Adicionar função `handleViewAnalysis` (após linha 91)

```typescript
const handleViewAnalysis = async (alertId: string, firewallId: string) => {
  // Dispensar o alerta primeiro
  await dismissAlert(alertId);
  // Navegar para a análise
  navigate(`/scope-firewall/firewalls/${firewallId}/analysis`);
};
```

#### Mudança D: Importar `useNavigate` (linha 3)

```typescript
import { Link, useNavigate } from 'react-router-dom';
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Habilitar realtime em `system_alerts` |
| `SystemAlertBanner.tsx` | Importar `useNavigate` |
| `SystemAlertBanner.tsx` | Adicionar hook de realtime subscription |
| `SystemAlertBanner.tsx` | Criar função `handleViewAnalysis` |
| `SystemAlertBanner.tsx` | Mudar botão "Ver Análise" para usar onClick |

---

## Fluxo Após Implementação

```text
┌─────────────────────────────────────────────────────────────┐
│                      agent-task-result                       │
│                                                              │
│  1. Análise concluída                                        │
│  2. INSERT em system_alerts (severity: 'success')            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Supabase Realtime                          │
│                                                              │
│  Broadcast: INSERT event para 'system_alerts'                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  SystemAlertBanner                           │
│                                                              │
│  1. Realtime callback dispara                                │
│  2. fetchActiveAlerts() executado                            │
│  3. Novo alerta aparece com animação slide-in-from-top       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Usuário clica "Ver Análise"                  │
│                                                              │
│  1. dismissAlert(alertId) → adiciona user ao dismissed_by    │
│  2. navigate() → redireciona para análise                    │
│  3. Banner desaparece instantaneamente                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Validação

1. Iniciar análise de firewall
2. Aguardar conclusão **SEM mudar de tela**
3. Banner verde deve aparecer automaticamente
4. Clicar em "Ver Análise"
5. Banner deve fechar E redirecionar para a análise
