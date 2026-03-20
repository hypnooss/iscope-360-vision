

## Plano: Tratar exibição do SO e adicionar card de IP

### Situação atual
- `os_info` retorna `"Oracle Linux Server 9.6 6.12.0-104.43.4.3.el9uek.x86_64"` — inclui a versão do kernel, que polui o card
- **IP não é coletado** pelo monitor Python. O campo não existe na tabela `agent_metrics` nem no blueprint atual

### Mudanças

#### 1. Formatar `os_info` — truncar versão do kernel
Criar uma função `formatOsInfo(raw)` que remove a parte do kernel. Lógica: pegar apenas a parte antes do primeiro token que comece com número seguido de ponto e contenha padrão de kernel (ex: `6.12.0-...`). Resultado: `"Oracle Linux Server 9.6"`.

#### 2. Adicionar coleta de IP no monitor
Para exibir o IP, precisamos de 3 alterações:

| Camada | Mudança |
|--------|---------|
| **Migração SQL** | Adicionar coluna `ip_addresses text[]` na tabela `agent_metrics` |
| **Edge Function `agent-monitor`** | Aceitar e salvar `body.ip_addresses` |
| **Blueprint (banco)** | Adicionar coleta de IP ao step `sys` ou criar novo step — isso requer update no blueprint via SQL migration |

**Nota:** O agente Python precisa ser atualizado para coletar IPs (lendo `/proc/net/fib_trie` ou via socket). Isso está fora do escopo do frontend, mas podemos preparar o frontend para exibir o dado quando disponível.

#### 3. Atualizar layout dos cards
- Grid de 3 para 4 colunas: `grid-cols-1 md:grid-cols-4`
- Adicionar card "Endereço IP" entre SO e Uptime, usando ícone `Network`
- Exibir lista de IPs ou "—" quando não disponível

### Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | Função `formatOsInfo`, card de IP, grid 4 colunas |
| `src/hooks/useAgentMetrics.ts` | Adicionar `ip_addresses` ao tipo `AgentMetricRow` |
| `supabase/functions/agent-monitor/index.ts` | Aceitar campo `ip_addresses` |
| Nova migração SQL | Coluna `ip_addresses text[]` em `agent_metrics` |

