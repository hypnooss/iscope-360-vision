
# Plano: Corrigir Uptime N/A e Adicionar Alerta de Coleta Concluída

## Resumo
Este plano resolve dois problemas:
1. **Uptime mostrando N/A** - O blueprint foi atualizado com formato incorreto
2. **Alerta de coleta** - Adicionar notificação quando o agent retorna dados

---

## Problema 1: Uptime N/A

### Diagnóstico
O blueprint `webui_state` foi adicionado com formato incorreto:
```json
// INCORRETO (atual)
{
  "id": "webui_state",
  "type": "http_request",  // ❌ Deveria ser "executor"
  "config": {
    "endpoint": "/api/v2/monitor/web-ui/state",  // ❌ Deveria ser "path"
    "method": "GET",
    "timeout": 30
  }
}
```

### Correção
Atualizar o blueprint com o formato correto:
```json
{
  "id": "webui_state",
  "executor": "http_request",  // ✅ Correto
  "config": {
    "path": "/api/v2/monitor/web-ui/state",  // ✅ Correto
    "method": "GET",
    "headers": { "Authorization": "Bearer {{api_key}}" },
    "timeout": 30,
    "verify_ssl": false
  }
}
```

### Ação
Executar SQL para corrigir o blueprint:
```sql
UPDATE device_blueprints 
SET collection_steps = jsonb_set(
  collection_steps,
  '{steps,18}',
  '{
    "id": "webui_state",
    "executor": "http_request",
    "config": {
      "path": "/api/v2/monitor/web-ui/state",
      "method": "GET",
      "headers": { "Authorization": "Bearer {{api_key}}" },
      "timeout": 30,
      "verify_ssl": false
    }
  }'::jsonb
)
WHERE id = '1130a1f7-9e04-4df8-9c12-50f86066611b';
```

---

## Problema 2: Alerta de Coleta Concluída

### Arquitetura Atual
- O sistema já possui `SystemAlertBanner` que exibe alertas da tabela `system_alerts`
- Atualmente só mostra para `super_admin`
- Alertas podem ter `severity`: info, warning, error

### Implementação

#### 2.1 Backend: Criar alerta no agent-task-result
**Arquivo:** `supabase/functions/agent-task-result/index.ts`

Após salvar o resultado da compliance (linha ~619), criar um alerta:

```typescript
// Create system alert for analysis completion
const firewallName = task.metadata?.firewall_name || 'Firewall';
await supabase
  .from('system_alerts')
  .insert({
    alert_type: 'firewall_analysis_completed',
    title: 'Análise Concluída',
    message: `A análise do firewall "${firewallName}" foi concluída com score ${score}%.`,
    severity: score >= 70 ? 'info' : score >= 50 ? 'warning' : 'error',
    target_role: null,  // Visível para todos os admins
    is_active: true,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
    metadata: {
      firewall_id: task.target_id,
      score: score,
      analysis_id: null  // Will be filled with the actual ID
    }
  });
```

#### 2.2 Frontend: Expandir visibilidade do alerta
**Arquivo:** `src/components/alerts/SystemAlertBanner.tsx`

Permitir que `workspace_admin` também veja alertas de análise:

```typescript
// Linha 23-27: Expandir condição
useEffect(() => {
  if (role === 'super_admin' || role === 'workspace_admin') {
    fetchActiveAlerts();
  }
}, [role]);

// Linha 89: Ajustar verificação de exibição
if (!['super_admin', 'workspace_admin'].includes(role || '') || visibleAlerts.length === 0) {
  return null;
}
```

#### 2.3 Frontend: Adicionar link para análise no alerta
**Arquivo:** `src/components/alerts/SystemAlertBanner.tsx`

Adicionar botão "Ver Análise" para alertas de firewall:

```typescript
// Após o botão de configurações M365 (linha 130-142)
{primaryAlert.alert_type === 'firewall_analysis_completed' && primaryAlert.metadata?.firewall_id && (
  <Button
    variant="ghost"
    size="sm"
    className="h-8 px-3 text-xs"
    asChild
  >
    <Link to={`/scope-firewall/firewalls/${primaryAlert.metadata.firewall_id}/analysis`}>
      <Shield className="h-3.5 w-3.5 mr-1.5" />
      Ver Análise
    </Link>
  </Button>
)}
```

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| **Database** | Corrigir formato do step `webui_state` no blueprint |
| `supabase/functions/agent-task-result/index.ts` | Criar alerta após salvar análise |
| `src/components/alerts/SystemAlertBanner.tsx` | Expandir visibilidade + link para análise |

---

## Fluxo Completo

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Agent coleta   │────▶│  agent-task-     │────▶│  Salva em       │
│  webui_state    │     │  result          │     │  analysis_      │
│  (com uptime)   │     │                  │     │  history        │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Cria alerta em  │
                        │  system_alerts   │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  SystemAlert     │
                        │  Banner exibe    │
                        │  no topo         │
                        └──────────────────┘
```

---

## Observações

1. **Nova análise necessária** - Após corrigir o blueprint, será necessário executar uma nova análise para coletar o uptime
2. **Alertas expiram em 24h** - Os alertas de análise são temporários
3. **Severidade dinâmica** - O alerta será verde (info) para score >= 70, amarelo (warning) 50-69, vermelho (error) < 50
