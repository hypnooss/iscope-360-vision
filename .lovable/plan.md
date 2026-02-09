

# Exchange Online: Botao "Reanalisar" Dedicado

## Problema Atual

O botao "Reanalisar" na pagina Exchange Online chama `trigger-m365-posture-analysis`, que executa **todos** os 5 blueprints (Entra ID, Exchange, SharePoint, Teams, Intune) e gera **uma unica** tarefa Agent com todos os comandos PowerShell. Isso e lento, desnecessario e gera erros 403 em endpoints que nao sao relevantes para Exchange.

## Arquitetura Proposta

Criar um fluxo de trigger dedicado para Exchange Online que:
1. Executa apenas o blueprint "M365 - Exchange Online" (API + Agent)
2. Persiste resultados em um registro proprio no `m365_posture_history`
3. O hook `useExchangeOnlineInsights` le esses resultados filtrados

### Fluxo

```text
[Botao Reanalisar (Exchange)]
        |
        v
[trigger-m365-posture-analysis]  (com novo param: scope = 'exchange_online')
        |
        +---> [Graph API] Executa APENAS steps do blueprint Exchange Online (1 step: sample_users_for_mailbox)
        +---> [exchange-online-insights] Analise de mailbox rules via Graph API (EXO-001..006)
        +---> [Agent Task] Cria tarefa PowerShell APENAS com comandos do blueprint Exchange
        |
        v
[m365_posture_history] (insights + agent_insights filtrados para exchange)
```

## Alteracoes

### 1. Edge Function: `trigger-m365-posture-analysis` -- Aceitar parametro `scope`

Adicionar suporte ao parametro opcional `scope` no body da requisicao:
- `scope: undefined` (padrao) -- comportamento atual, executa tudo
- `scope: 'exchange_online'` -- executa apenas o blueprint Exchange Online

Quando `scope = 'exchange_online'`:
- Na chamada a `m365-security-posture`, passa `blueprint_filter: 'exchange_online'`
- Tambem chama `exchange-online-insights` (analise de inbox rules via Graph API)
- Na criacao da agent task, inclui no payload: `scope: 'exchange_online'` para que `rpc_get_agent_tasks` filtre apenas o blueprint do Exchange

### 2. Edge Function: `m365-security-posture` -- Filtrar blueprints por scope

Na secao que carrega blueprints (linha 679), aceitar parametro opcional `blueprint_filter`:
- Se `blueprint_filter = 'exchange_online'`, carregar apenas o blueprint com nome contendo "Exchange"
- Isso faz com que apenas os steps de Graph API do Exchange sejam executados (1 step atualmente)
- As compliance rules tambem devem ser filtradas por categoria relevante (`email_exchange`, `threats_activity`)

### 3. Hook: `useExchangeOnlineInsights` -- Passar scope no trigger

Alterar `triggerAnalysis` para enviar `scope: 'exchange_online'` no body da chamada a `trigger-m365-posture-analysis`.

### 4. Edge Function: `trigger-m365-posture-analysis` -- Integrar `exchange-online-insights`

Quando `scope = 'exchange_online'`, alem de chamar `m365-security-posture` (com filtro), tambem chamar `exchange-online-insights` e mesclar os resultados no campo `insights` do registro de historico.

## Detalhes Tecnicos

### Arquivo: `supabase/functions/trigger-m365-posture-analysis/index.ts`

Alteracoes:
- Aceitar `scope` no body (linha 43)
- Passar `scope` e `blueprint_filter` ao chamar `m365-security-posture` (linha 181)
- Quando scope = exchange_online, tambem chamar `exchange-online-insights` e mesclar resultados (dentro de `runAnalysis()`)
- Na criacao da agent task, incluir scope no payload (linha 138)

### Arquivo: `supabase/functions/m365-security-posture/index.ts`

Alteracoes:
- Aceitar `blueprint_filter` no body (linha 639)
- Filtrar blueprints com base no filtro (linha 679): se `blueprint_filter = 'exchange_online'`, carregar apenas o blueprint "M365 - Exchange Online"
- Filtrar compliance rules por categorias relevantes ao scope

### Arquivo: `src/hooks/useExchangeOnlineInsights.ts`

Alteracoes:
- Em `triggerAnalysis` (linha 170), adicionar `scope: 'exchange_online'` no body da chamada

## Resultado Esperado

- O botao "Reanalisar" no Exchange Online executa apenas ~20 verificacoes (1 API + ~18 PowerShell + 5 inbox rules) em vez de 57+
- Tempo de execucao reduzido significativamente
- Sem erros 403 em endpoints irrelevantes (PIM, Intune, SharePoint, etc.)
- Os dados de Exchange aparecem corretamente na pagina

