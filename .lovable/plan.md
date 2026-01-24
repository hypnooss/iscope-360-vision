
# Plano: Completar Integração Agent-Firewall

## Objetivo
Permitir que a análise de firewalls seja executada pelo agent genérico, criando tarefas na tabela `agent_tasks` em vez de chamar a edge function diretamente.

## Mudanças Necessárias

### 1. Banco de Dados

#### 1.1 Adicionar coluna `agent_id` na tabela `firewalls`
```sql
ALTER TABLE public.firewalls 
ADD COLUMN agent_id UUID REFERENCES public.agents(id);
```

#### 1.2 Atualizar firewalls existentes
- Associar `device_type_id` do FortiGate aos firewalls ITP-FW e SAO-FW
- Associar o agent ESTRELA-SAO aos firewalls do cliente Estrela

### 2. Interface - Formulário de Firewall

#### 2.1 Modificar `AddFirewallDialog.tsx`
- Adicionar campo para selecionar **Device Type** (FortiGate, Palo Alto, etc.)
- Adicionar campo para selecionar **Agent** (filtrado por cliente)

#### 2.2 Modificar `EditFirewallDialog.tsx`
- Incluir os mesmos campos de Device Type e Agent

### 3. Edge Function - Disparar Análise via Agent

#### 3.1 Criar nova edge function `trigger-firewall-analysis`
Esta função será chamada pelo botão "Analisar" e criará uma tarefa no `agent_tasks`:

```text
Input:
  - firewall_id: UUID

Processo:
  1. Buscar dados do firewall (incluindo agent_id, device_type_id)
  2. Validar se firewall tem agent e device_type associados
  3. Criar registro em agent_tasks:
     - agent_id: do firewall
     - task_type: 'fortigate_compliance'
     - target_id: firewall_id
     - target_type: 'firewall'
     - status: 'pending'
     - expires_at: now() + 1 hora

Output:
  - task_id: UUID da tarefa criada
  - message: "Análise agendada"
```

### 4. Interface - Botão Analisar

#### 4.1 Modificar `FirewallListPage.tsx`
Alterar a função `handleAnalyze` para:
1. Chamar `trigger-firewall-analysis` em vez de `fortigate-compliance`
2. Mostrar toast informando que a análise foi agendada
3. Adicionar indicador de "Aguardando análise" para tasks pendentes

### 5. Atualizar Dados Existentes

#### 5.1 Query de UPDATE
```sql
-- Associar device_type_id (FortiGate) aos firewalls
UPDATE firewalls 
SET device_type_id = (SELECT id FROM device_types WHERE code = 'fortigate')
WHERE device_type_id IS NULL;

-- Associar agent aos firewalls do mesmo cliente
UPDATE firewalls f
SET agent_id = (
  SELECT a.id FROM agents a 
  WHERE a.client_id = f.client_id 
  AND a.revoked = false 
  LIMIT 1
)
WHERE agent_id IS NULL;
```

## Fluxo Completo Após Implementação

```text
1. Usuário clica "Analisar" no firewall
         │
         ▼
2. Frontend chama: trigger-firewall-analysis
         │
         ▼
3. Edge Function cria task em agent_tasks
   (status: pending, agent_id: do firewall)
         │
         ▼
4. Agent faz heartbeat → has_pending_tasks: true
         │
         ▼
5. Agent chama GET agent-tasks
   → Recebe steps do blueprint
         │
         ▼
6. Agent executa http_request para cada step
         │
         ▼
7. Agent POST agent-task-result
   → Envia dados brutos
         │
         ▼
8. Backend processa com compliance_rules
   → Calcula score
   → Salva em analysis_history
   → Atualiza last_score no firewall
```

## Ordem de Implementação

1. **Migração SQL**: Adicionar coluna `agent_id` na tabela `firewalls`
2. **UPDATE dados**: Associar device_type_id e agent_id aos firewalls existentes
3. **Edge Function**: Criar `trigger-firewall-analysis`
4. **Frontend**: Modificar formulários (Add/Edit) para incluir device type e agent
5. **Frontend**: Modificar botão Analisar para usar nova edge function
6. **Testes**: Validar fluxo completo

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx_add_agent_to_firewalls.sql` | Criar |
| `supabase/functions/trigger-firewall-analysis/index.ts` | Criar |
| `src/components/firewall/AddFirewallDialog.tsx` | Modificar |
| `src/components/firewall/EditFirewallDialog.tsx` | Modificar |
| `src/pages/firewall/FirewallListPage.tsx` | Modificar |

