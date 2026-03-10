

## Análise do fluxo "Executar Análise" no Exchange Analyzer

### O que acontece ao clicar no botão

O `handleTriggerAnalysis` (linha 104-122 de `ExchangeAnalyzerPage.tsx`) dispara **duas chamadas em paralelo** via `Promise.all`:

```text
┌──────────────────────────────────────────────────────────┐
│                  handleTriggerAnalysis()                  │
│                                                          │
│  Promise.all([                                           │
│    1. trigger-m365-analyzer  →  cria agent_task (Agent)  │
│    2. exchange-dashboard     →  Graph API direto (KPIs)  │
│  ])                                                      │
└──────────────────────────────────────────────────────────┘
```

### Chamada 1: `trigger-m365-analyzer` (Agent + PowerShell)

- Cria um snapshot `pending` em `m365_analyzer_snapshots`
- Cria um `agent_task` com `task_type: 'm365_analyzer'` e `target_type: 'm365_tenant'`
- O **Agent Python** (via heartbeat/polling) pega essa task e executa os **comandos PowerShell** do Exchange Online (inbox rules, forwarding, mailbox stats, message trace, etc.)
- Quando o Agent termina, ele envia os resultados de volta, o que aciona a Edge Function **`m365-analyzer`**
- O `m365-analyzer` faz o **enriquecimento híbrido**: combina os dados do Agent (PowerShell) com dados da **Graph API** (signInLogs, riskyUsers, conditionalAccess, serviceHealth, etc.)
- Grava o snapshot com status `completed`, incluindo `insights`, `metrics` e `summary`

**Resultado**: Popula os insights de segurança, métricas de threat protection, behavioral baseline, suspicious rules, exfiltration -- tudo que aparece nos cards de insights e na grade de categorias.

### Chamada 2: `exchange-dashboard` (Graph API direto)

- Executa **imediatamente** (sem Agent)
- Chama a Graph API para: mailboxes, tráfego de email, segurança (phishing, malware, spam)
- Salva o cache em `m365_tenants.exchange_dashboard_cache`

**Resultado**: Popula os KPIs de status (total de mailboxes, over quota, forwarding, tráfego enviado/recebido, segurança).

### Confirmação: SIM, ambas as coletas são disparadas

O botão **dispara corretamente as duas fontes de dados**:
- Graph API direta (exchange-dashboard) -- retorna imediatamente
- Agent PowerShell (trigger-m365-analyzer → m365-analyzer com enriquecimento Graph) -- assíncrono

### Problema identificado: falta de feedback de conclusão

O `trigger-m365-analyzer` apenas **agenda** a task. O Agent pode levar minutos para executar. O `setTriggering(false)` acontece assim que a chamada HTTP retorna (ou seja, quando a task foi criada, não quando terminou). A tela não faz **polling nem subscription** para detectar quando o snapshot muda de `pending` para `completed`.

Isso explica o "dados não sincronizados": o `exchange-dashboard` pode ter falhado silenciosamente (já corrigido no scheduler), e o snapshot do analyzer pode estar `pending` ou `processing` ainda quando o usuário olha a tela.

### Recomendação

Não é necessária nenhuma alteração estrutural -- o fluxo está correto. O fix já aplicado no scheduler (retry + log) deve resolver o problema dos dados do exchange-dashboard não sincronizando. Para melhorar a experiência, poderíamos adicionar um **polling** no hook `useLatestM365AnalyzerSnapshot` que recarrega a cada 15s enquanto o snapshot mais recente estiver com status `pending` ou `processing`, mas isso seria uma melhoria separada.

