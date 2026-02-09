
# Padronizar M365 Execucoes com Dominio Externo

Tres alteracoes no arquivo `src/pages/m365/M365ExecutionsPage.tsx`:

## 1. Tag "PowerShell" -> "Agent" com cor roxa (typeConfig)

Linhas 99-115: Simplificar o `typeConfig` para usar apenas dois tipos como o Dominio Externo:

| Atual (M365) | Novo (padrao Dominio Externo) |
|---|---|
| `posture_analysis` -> label "API", cor azul | `posture_analysis` -> label "API", cor **teal-400** |
| `m365_powershell` -> label "PowerShell", cor roxa | `m365_powershell` -> label "**Agent**", cor roxa (mantida) |
| `m365_graph_api` -> label "Graph API", cor cyan | `m365_graph_api` -> label "**Agent**", cor roxa |

## 2. Coluna Agent: exibir "Edge Function" para tarefas API

Linha 539: Trocar `{item.agentId ? getAgentName(item.agentId) : '-'}` por:
```
{item.type === 'posture_analysis' ? 'Edge Function' : item.agentId ? getAgentName(item.agentId) : '-'}
```

## 3. Cor da tag API: azul -> teal

Linha 101-103: Mudar de `bg-blue-500/20 text-blue-500 border-blue-500/30` para `bg-teal-400/20 text-teal-400 border-teal-400/30`.

## Resumo das alteracoes

| Item | Antes | Depois |
|---|---|---|
| Tag tipo API | Azul | Teal (como Dominio Externo) |
| Tag tipo PowerShell | ">_ PowerShell" | ">_ Agent" |
| Tag tipo Graph API | ">_ Graph API" | ">_ Agent" |
| Coluna Agent (API) | "-" | "Edge Function" |

## Arquivo afetado

`src/pages/m365/M365ExecutionsPage.tsx` - unico arquivo alterado.
