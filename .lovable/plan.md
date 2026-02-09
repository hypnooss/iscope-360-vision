

# Segmentar Blueprints M365 por Produto

## Contexto Atual

Existem 2 blueprints para o device_type Microsoft 365:

1. **M365 - Exchange & SharePoint (Agent)** - 10 steps PowerShell (todos Exchange Online)
2. **M365 - Postura de Seguranca** - 39 steps Graph API cobrindo todos os produtos

A edge function `m365-security-posture` carrega apenas **1 blueprint** (`LIMIT 1`) e chama 5 sub-funcoes hardcoded para Intune, PIM, SharePoint, Teams e Defender.

## Nova Estrutura Proposta

Segmentar em **5 blueprints** por produto:

```text
+------------------------------+------------+--------+-----------------------------+
| Blueprint                    | Executor   | Steps  | Categorias de Regras        |
+------------------------------+------------+--------+-----------------------------+
| M365 - Entra ID              | edge_func  | 25     | identities, auth_access,    |
|                              |            |        | admin_privileges,           |
|                              |            |        | apps_integrations,          |
|                              |            |        | pim_governance, environment |
+------------------------------+------------+--------+-----------------------------+
| M365 - Exchange Online       | hybrid     | 10+1   | email_exchange,             |
|                              | (agent+ef) |        | threats_activity (parcial)  |
+------------------------------+------------+--------+-----------------------------+
| M365 - SharePoint & OneDrive | edge_func  | 2+sub  | sharepoint_onedrive         |
+------------------------------+------------+--------+-----------------------------+
| M365 - Teams                 | edge_func  | 2+sub  | teams_collaboration         |
+------------------------------+------------+--------+-----------------------------+
| M365 - Intune & Defender     | edge_func  | 3+6+sub| intune_devices,             |
|                              |            |        | defender_security,          |
|                              |            |        | threats_activity (parcial)  |
+------------------------------+------------+--------+-----------------------------+
```

## Mudancas Necessarias

### 1. Banco de Dados (device_blueprints)

**Atualizar** o blueprint existente "M365 - Postura de Seguranca" para conter apenas os steps de Entra ID e renomea-lo para **"M365 - Entra ID"**.

**Atualizar** o blueprint existente "M365 - Exchange & SharePoint (Agent)" para conter tambem o step `sample_users_for_mailbox` (Graph API) e os steps de threats_activity relacionados a email. Renomear para **"M365 - Exchange Online"**. Mudar `executor_type` para `hybrid`.

**Criar 3 novos blueprints**:
- **M365 - SharePoint & OneDrive** (edge_function): steps `sharepoint_sites`, `sharepoint_external_sharing`
- **M365 - Teams** (edge_function): steps `teams_list`, `teams_settings`
- **M365 - Intune & Defender** (edge_function): steps `managed_devices`, `device_compliance_policies`, `device_configuration_policies`, `security_alerts_v1`, `security_alerts_v2`, `secure_scores`

### 2. Edge Function: m365-security-posture

Atualmente carrega 1 blueprint com `LIMIT 1`. Precisa ser alterada para:

- Carregar **todos** os blueprints ativos do device_type M365 com `executor_type = 'edge_function'` ou `'hybrid'`
- Iterar sobre cada blueprint e executar seus steps Graph API
- Unificar os resultados de todos os blueprints em um unico Map de `stepResults`
- **Remover** as chamadas hardcoded das 5 sub-funcoes (`m365-check-intune`, `m365-check-pim`, `m365-check-sharepoint`, `m365-check-teams`, `m365-check-defender`), ja que os steps agora estao nos blueprints segmentados
- Manter a avaliacao de regras e calculo de score inalterados

Mudancas especificas:
- Linha 679-686: trocar `.single()` por buscar multiplos blueprints
- Linhas 780-786: remover chamadas de sub-funcoes (dados ja coletados via blueprints)
- Ajustar log para mostrar quantos blueprints foram carregados

### 3. Edge Function: trigger-m365-posture-analysis

Sem mudancas necessarias - ja cria a task corretamente e chama `m365-security-posture`.

### 4. Agente Python (agent/tasks.py ou RPC)

A funcao `rpc_get_agent_tasks` ja busca blueprints por device_type `m365` e executor `agent`. Com a renomeacao, ela continuara funcionando pois filtra por `executor_type`, nao por nome.

### 5. Frontend (TemplateDetailPage)

Sem mudancas necessarias - ja lista todos os blueprints do device_type dinamicamente.

## Secao Tecnica - Detalhes de Implementacao

### Queries SQL para segmentar os blueprints

Os dados serao manipulados via `UPDATE` e `INSERT` nos blueprints existentes. Os steps de cada blueprint serao redistribuidos conforme o mapeamento de categorias acima.

### Logica de carregamento multi-blueprint

```text
// Antes (1 blueprint):
.eq('is_active', true).limit(1).single()

// Depois (todos os blueprints edge_function/hybrid):
.eq('is_active', true).in('executor_type', ['edge_function', 'hybrid'])
```

Os steps de todos os blueprints serao agregados em um unico array antes da execucao paralela.

### Remocao das sub-funcoes

As sub-funcoes `m365-check-intune`, `m365-check-pim`, `m365-check-sharepoint`, `m365-check-teams` e `m365-check-defender` contem logica de avaliacao complexa que ja foi migrada para `compliance_rules` com `evaluation_logic`. Elas serao removidas das chamadas, mas os arquivos podem ser mantidos temporariamente como fallback.

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/m365-security-posture/index.ts` | Carregar multiplos blueprints, remover sub-funcoes |
| Banco de dados (device_blueprints) | Renomear e redistribuir steps entre 5 blueprints |

## Riscos e Mitigacao

- **Sub-funcoes com logica complexa**: Intune, PIM, SharePoint, Teams e Defender usam chamadas Graph API internas que nao estao nos steps do blueprint. Sera necessario verificar se todos os endpoints ja estao cadastrados como steps antes de remover as sub-funcoes.
- **Fallback**: Manter as sub-funcoes como fallback ate validar que todos os insights sao gerados corretamente pelos blueprints segmentados.

