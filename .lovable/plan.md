

## Plano: Corrigir cards de info do sistema mostrando "—"

### Causa raiz
O monitor template-driven envia métricas parciais — cada step tem seu próprio `interval_seconds`. Hostname, OS e Uptime são coletados com intervalo maior (ex: 1h), enquanto CPU/RAM/Disco são coletados a cada 30-60s. Resultado: a maioria das linhas no banco não tem `hostname`, `os_info`, `uptime_seconds` preenchidos. O código usa `latest` (última linha), que provavelmente é uma linha parcial sem esses campos.

### Solução
Em `AgentMonitorPanel.tsx`, ao invés de usar apenas `latest` para os cards de info, buscar o valor mais recente de cada campo escaneando de trás para frente:

```text
// Exemplo da lógica:
const latestHostname = findLastValue(metrics, 'hostname')
const latestOsInfo = findLastValue(metrics, 'os_info')  
const latestUptime = findLastValue(metrics, 'uptime_seconds')
```

Criar uma função helper `findLastNonNull(metrics, field)` que itera do final para o início e retorna o primeiro valor não-null.

### Arquivo

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | Adicionar helper `findLastNonNull` e usá-lo para os 3 cards de info |

