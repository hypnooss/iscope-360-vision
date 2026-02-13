
# Corrigir comando de instalacao na pagina de detalhes do Agent

## Problema

Na pagina `AgentDetailPage`, o componente `AgentInstallInstructions` e renderizado **sem** a prop `isSuperAgent`, independentemente do tipo do agente. Isso faz com que Super Agents (que tem `client_id = null`) exibam o comando de instalacao errado (`agent-install` em vez de `super-agent-install`).

Quando o usuario reinstalou o Super Agent usando o comando errado, o instalador comum foi executado -- ele nao instala masscan, nmap nem httpx, e por isso os executors ficaram ausentes, causando os erros "Executor desconhecido".

## Solucao

Passar `isSuperAgent={!agent.client_id}` no componente `AgentInstallInstructions` dentro de `AgentDetailPage.tsx`.

## Alteracao

| Arquivo | Mudanca |
|---|---|
| `src/pages/AgentDetailPage.tsx` (linha 648) | Alterar de `<AgentInstallInstructions activationCode={agent.activation_code} />` para `<AgentInstallInstructions activationCode={agent.activation_code} isSuperAgent={!agent.client_id} />` |

## Apos aplicar

O Super Agent OCI-01 precisara ser reinstalado com o comando correto (`super-agent-install`) para que os executors masscan, nmap e httpx sejam instalados.
