

# Unificar Execucoes de Dominio Externo: Agent + API

## Contexto

Atualmente a pagina **Execucoes** do modulo Dominio Externo (`ExternalDomainExecutionsPage`) exibe apenas as tasks do **Agent** (tabela `agent_tasks` com `target_type = 'external_domain'`).

Porem, a analise de dominio externo tambem gera registros na tabela `external_domain_analysis_history` quando a Edge Function `subdomain-enum` executa a enumeracao de subdominios via APIs externas. Esses registros de API nao aparecem na pagina de execucoes.

O objetivo e replicar o padrao ja implementado em `M365ExecutionsPage`, que unifica duas fontes de dados (`m365_posture_history` + `agent_tasks`) em uma tabela unica com tags visuais distintas.

## Estrutura Unificada

```text
+-------------------+---------------------+-------------------------------+
| Fonte             | Tabela              | Tag Visual                    |
+-------------------+---------------------+-------------------------------+
| API (Edge Func)   | external_domain_    | Icone Cloud + "API"           |
|                   | analysis_history    | (azul)                        |
+-------------------+---------------------+-------------------------------+
| Agent (Python)    | agent_tasks         | Icone Terminal + "Agent"      |
|                   | target_type =       | (roxo)                        |
|                   | external_domain     |                               |
+-------------------+---------------------+-------------------------------+
```

## Colunas da Tabela Unificada

| Coluna | Fonte API | Fonte Agent |
|--------|-----------|-------------|
| Dominio | `domain_id` -> lookup `external_domains` | `target_id` -> lookup `external_domains` |
| Agent | "Edge Function" (fixo) | `agent_id` -> lookup `agents` |
| Tipo | Badge "API" (Cloud icon, azul) | Badge "Agent" (Terminal icon, roxo) |
| Status | Mapear: score != null = completed, else pending | Campo `status` direto |
| Criado em | `created_at` | `created_at` |
| Duracao | Calculada (se `completed_at` existir) | `execution_time_ms` |
| Acoes | Ver detalhes (score, report_data) | Ver detalhes (payload, result, steps) |

## Mudancas no Arquivo

### `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`

1. **Adicionar interface `AnalysisHistory`** com campos de `external_domain_analysis_history` (id, domain_id, score, created_at, report_data)

2. **Adicionar interface `UnifiedExecution`** similar ao M365:
   - `id`, `source` ('analysis' | 'agent_task'), `domainId`, `agentId`, `type` ('api' | 'agent'), `status`, `duration`, `createdAt`, `original`

3. **Adicionar query para `external_domain_analysis_history`**: buscar registros com os mesmos filtros de tempo e preview mode

4. **Adicionar `typeConfig`** com badges visuais:
   - `api`: Cloud icon, label "API", cor azul
   - `agent`: Terminal icon, label "Agent", cor roxa

5. **Criar `unifiedExecutions`** via `useMemo` que mescla ambas as fontes e ordena por `createdAt` desc

6. **Atualizar stats** para contar do array unificado

7. **Atualizar a tabela** para usar `unifiedExecutions` em vez de `filteredTasks`:
   - Coluna "Agent" mostra "Edge Function" para API ou nome do agent
   - Coluna "Tipo" mostra badge colorido com icone
   - Dialogo de detalhes diferenciado por `source`

8. **Adicionar dialogo de detalhes para API**: exibir score, dados do report_data resumido

9. **Importar icones** `Cloud` e `Terminal` do lucide-react (Cloud ja nao esta importado)

## Nenhuma Mudanca no Backend

- A tabela `external_domain_analysis_history` ja existe e contem os dados necessarios
- A Edge Function `subdomain-enum` ja persiste os resultados nesta tabela
- O trigger `trigger-external-domain-analysis` cria apenas a task do Agent
- Nao e necessario criar uma nova task separada para API; os registros de historico ja existem

## Arquivo Modificado

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/external-domain/ExternalDomainExecutionsPage.tsx` | Refatorar para unificar agent_tasks + analysis_history com tags visuais |

