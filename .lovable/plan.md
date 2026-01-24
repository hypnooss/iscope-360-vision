
# Plano: Tratamento Automático de Tasks Expiradas/Travadas

## Problema Identificado

Quando uma task fica travada em status `running` (por exemplo, devido a um timeout de rede), ela nunca é marcada como `failed`. Isso causa:
1. O usuário não consegue iniciar nova análise (erro 409 Conflict)
2. Necessidade de intervenção manual no banco de dados

## Solução Proposta

Implementar limpeza automática de tasks expiradas em dois pontos estratégicos:

### Abordagem

Modificar a Edge Function `trigger-firewall-analysis` para:
1. Antes de verificar duplicatas, limpar automaticamente tasks que já expiraram
2. Marcar tasks expiradas como `timeout` ou `failed` com mensagem explicativa

## Mudanças Técnicas

### 1. Atualizar `trigger-firewall-analysis/index.ts`

Adicionar lógica de cleanup antes da verificação de duplicatas:

```typescript
// ANTES de verificar existingTask, limpar tasks expiradas
const { data: expiredTasks } = await supabase
  .from('agent_tasks')
  .update({
    status: 'timeout',
    error_message: 'Task expirada automaticamente pelo sistema',
    completed_at: new Date().toISOString()
  })
  .eq('target_id', firewall_id)
  .eq('target_type', 'firewall')
  .in('status', ['pending', 'running'])
  .lt('expires_at', new Date().toISOString())
  .select('id');

if (expiredTasks?.length) {
  console.log(`[trigger-firewall-analysis] Auto-cleaned ${expiredTasks.length} expired tasks`);
}

// Depois continua com a verificação normal de duplicatas
// (que agora só encontrará tasks válidas não expiradas)
```

### 2. Melhorar verificação de duplicatas

Adicionar filtro `expires_at` na query de duplicatas para ignorar tasks já expiradas:

```typescript
const { data: existingTask } = await supabase
  .from('agent_tasks')
  .select('id, status, expires_at')
  .eq('target_id', firewall_id)
  .eq('target_type', 'firewall')
  .in('status', ['pending', 'running'])
  .gt('expires_at', new Date().toISOString())  // Apenas tasks não expiradas
  .maybeSingle();
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/trigger-firewall-analysis/index.ts` | Adicionar cleanup automático + filtro de expiração |

## Fluxo Atualizado

```text
Usuário clica "Analisar"
         │
         ▼
┌─────────────────────────────────┐
│ trigger-firewall-analysis       │
├─────────────────────────────────┤
│ 1. Limpa tasks expiradas        │◄── NOVO
│    (status → timeout)           │
│                                 │
│ 2. Verifica duplicatas válidas  │◄── Filtro expires_at
│    (apenas não expiradas)       │
│                                 │
│ 3. Cria nova task se permitido  │
└─────────────────────────────────┘
```

## Benefícios

1. **Sem intervenção manual**: Tasks travadas são limpas automaticamente
2. **Transparente**: O cleanup acontece na mesma chamada, sem delay
3. **Histórico preservado**: Tasks são marcadas como `timeout`, não deletadas
4. **Retrocompatível**: Nenhuma mudança no Python agent ou outras Edge Functions

## Alternativa Considerada (para futuro)

Criar um **cron job** (Supabase pg_cron ou Edge Function agendada) que periodicamente limpa tasks expiradas de todo o sistema. Útil para:
- Manter a tabela `agent_tasks` limpa
- Enviar notificações de falha
- Gerar alertas para administradores

Esta alternativa pode ser implementada posteriormente como melhoria adicional.
