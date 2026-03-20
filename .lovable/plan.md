

## Plano: Aumentar altura vertical dos gráficos

### Mudança

Trocar `h-48` (192px) por `h-64` (256px) em todos os containers de gráficos do `AgentMonitorPanel.tsx`. Isso dá mais espaço vertical para que legendas com duas linhas não "esmaguem" a área do chart.

### Locais (6 ocorrências em `AgentMonitorPanel.tsx`)

| Linha aprox. | Gráfico | Mudança |
|---|---|---|
| 440 | CPU | `h-48` → `h-64` |
| 459 | RAM | `h-48` → `h-64` |
| 499 | Disco (partições) | `h-48` → `h-64` |
| 523 | Disco (legado) | `h-48` → `h-64` |
| 565 | Rede (interfaces) | `h-48` → `h-64` |
| 593 | Rede (legado) | `h-48` → `h-64` |

