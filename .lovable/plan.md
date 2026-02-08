
# Plano: Correção da Coleta de Dados Exchange Online

## Resumo do Problema

A página Exchange Online exibe apenas **2 insights** (ambos do Agent). Os dados via Graph API **não estão sendo coletados** corretamente.

### Causa Raiz

| Componente | Status | Problema |
|------------|--------|----------|
| Blueprint (step) | ⚠️ Incompleto | Só tem 1 step (`sample_users_for_mailbox`) que lista usuários, não coleta dados de Exchange |
| Regras EXO-xxx | ❌ Inativas | Falta `source_key` no `evaluation_logic` - função `evaluateRule` ignora |
| Edge Function | ❌ Incompleta | Tipos `count_threshold` e `informational` não implementados no switch/case |

### Dados Coletados Atualmente

```text
Via Agent (PowerShell):     Via API (Graph):
──────────────────────      ─────────────────
✅ exo_mailbox_forwarding   ❌ Sem coleta real
✅ exo_dkim_config          ❌ Step só lista usuários
✅ exo_transport_rules      ❌ Sem endpoints de Exchange
✅ exo_anti_phish_policy
✅ exo_safe_links_policy
✅ ...outros 5 steps
```

---

## Opções de Solução

### Opção A: Focar Exchange no Agent (Recomendada)

O PowerShell tem acesso mais completo aos dados do Exchange. A Graph API tem limitações:
- Requer chamadas por usuário (N+1 queries)
- Alguns endpoints não existem na Graph API
- Permissões mais complexas

**Ação**: Remover/desativar regras EXO da avaliação via API e manter apenas Agent.

### Opção B: Implementar Coleta Completa via Graph API

Adicionar steps e lógica de avaliação para coletar dados via API:
1. Adicionar steps no blueprint para cada endpoint
2. Implementar tipos de avaliação na Edge Function
3. Atualizar `source_key` nas regras

**Complexidade**: Alta (muitas chamadas N+1, timeouts prováveis)

---

## Implementação Recomendada (Opção A)

### Fase 1: Remover step desnecessário do blueprint

O step `sample_users_for_mailbox` não serve para nada atualmente, pois as regras EXO não estão funcionando.

```sql
-- Remover step que não gera insights
UPDATE device_blueprints
SET collection_steps = jsonb_set(
  collection_steps,
  '{steps}',
  (SELECT jsonb_agg(step) 
   FROM jsonb_array_elements(collection_steps->'steps') step 
   WHERE step->>'id' != 'sample_users_for_mailbox')
)
WHERE id = '164ad4d2-35c6-46cd-9c70-bcd27b044b73';
```

### Fase 2: Desativar regras EXO que dependem de Graph API

```sql
-- Desativar regras que não funcionam via API
UPDATE compliance_rules
SET is_active = false
WHERE code IN ('EXO-001', 'EXO-002', 'EXO-003', 'EXO-004', 'EXO-005')
  AND api_endpoint LIKE '/users%';
```

### Fase 3: Garantir que Agent gera mais insights

Atualmente o Agent gera apenas 2 insights. Verificar se o `processM365AgentInsights` está processando todos os dados coletados:

**Dados coletados pelo Agent:**
- `exo_mailbox_forwarding` → Insight de encaminhamento ✅
- `exo_dkim_config` → Insight de DKIM ✅
- `exo_transport_rules` → Deveria gerar insight ❌
- `exo_anti_phish_policy` → Deveria gerar insight ❌
- `exo_safe_links_policy` → Deveria gerar insight ❌
- `exo_malware_filter_policy` → Deveria gerar insight ❌
- `exo_hosted_content_filter` → Deveria gerar insight ❌
- `exo_safe_attachment_policy` → Deveria gerar insight ❌
- `exo_remote_domains` → Deveria gerar insight ❌
- `exo_owa_mailbox_policy` → Deveria gerar insight ❌

**Problema**: A função `processM365AgentInsights` em `agent-task-result/index.ts` só processa 2 tipos de dados.

---

## Arquivos a Modificar

### 1. Edge Function `agent-task-result/index.ts`

Expandir `processM365AgentInsights` para processar todos os dados do Exchange:

| Step ID | Insight a Gerar |
|---------|-----------------|
| `exo_transport_rules` | Regras de transporte configuradas |
| `exo_anti_phish_policy` | Política Anti-Phishing |
| `exo_safe_links_policy` | Safe Links habilitado |
| `exo_safe_attachment_policy` | Safe Attachments habilitado |
| `exo_malware_filter_policy` | Filtro de malware |
| `exo_hosted_content_filter` | Filtro de spam |
| `exo_remote_domains` | Domínios remotos |
| `exo_owa_mailbox_policy` | Política OWA |

### 2. Migração SQL

Limpar steps e regras não funcionais:

```sql
-- 1. Remover step não utilizado
-- 2. Desativar regras EXO via API
```

---

## Fluxo Corrigido

```text
ANTES:
┌─────────────────────────────────────────────────────────────────┐
│ Edge Function (API)         Agent (PowerShell)                  │
│ ─────────────────          ─────────────────────                │
│ 1 step (sample_users)      10 steps (Exchange completo)        │
│       ↓                           ↓                            │
│ 0 insights                  2 insights                         │
│       ↓                           ↓                            │
│         └──────────────┬──────────┘                            │
│                        ↓                                        │
│              Exchange Online Page                               │
│              (exibe 2 insights)                                 │
└─────────────────────────────────────────────────────────────────┘

DEPOIS:
┌─────────────────────────────────────────────────────────────────┐
│ Edge Function (API)         Agent (PowerShell)                  │
│ ─────────────────          ─────────────────────                │
│ 0 steps (removido)         10 steps (Exchange completo)        │
│       ↓                           ↓                            │
│ N/A                         10+ insights (todos processados)   │
│                                   ↓                            │
│              Exchange Online Page                               │
│              (exibe 10+ insights)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Benefícios

1. **Mais insights**: De 2 para 10+ insights de Exchange
2. **Dados mais completos**: PowerShell acessa APIs legadas não disponíveis via Graph
3. **Menos complexidade**: Remove código não funcional
4. **Performance**: Menos chamadas de API desnecessárias

---

## Ordem de Implementação

1. Expandir `processM365AgentInsights` para todos os steps do Exchange
2. Aplicar migração SQL para limpar blueprint e regras
3. Testar nova análise e verificar 10+ insights na UI
