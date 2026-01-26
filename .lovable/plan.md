# Plano: Correção de Evidências HA Heartbeat e Regras Any-to-Any

## Status: ✅ IMPLEMENTADO

## Resumo Executivo

Correção da exibição de evidências para duas verificações de compliance no FortiGate:
1. **Heartbeat HA (ha-003)**: Não exibe dados de heartbeat quando HA está desabilitado
2. **Regras Any-to-Any (net-003)**: Formatador específico seguindo padrão das regras inb-*

---

## Alterações Realizadas

### Arquivo: `supabase/functions/agent-task-result/index.ts`

1. **Novo Formatador: `formatHAHeartbeatEvidence`** (~linha 570)
   - Verifica se HA mode = standalone → retorna "N/A - HA não configurado" e suprime rawData
   - Se HA ativo + 0 links → FAIL
   - Se HA ativo + 1 link → WARN (ponto único de falha)
   - Se HA ativo + 2+ links → PASS

2. **Novo Formatador: `formatAnyToAnyEvidence`** (~linha 970)
   - Analisa todas as policies do firewall_policy
   - Detecta policies onde srcaddr=all E dstaddr=all
   - Se não encontrar → "Nenhuma regra vulnerável encontrada" SEM rawData
   - Se encontrar → Lista ID e Nome de cada policy + rawData

3. **Integração no `processComplianceRules`** (~linha 1180)
   - Adicionado tratamento para `ha-003` usando `formatHAHeartbeatEvidence`
   - Adicionado tratamento para `net-003` usando `formatAnyToAnyEvidence`

4. **Atualização da lógica de rawData** (~linha 1262)
   - `net-003`: Só inclui rawData quando há policies any-any
   - `ha-003`: Só inclui rawData quando HA está configurado (não standalone)

---

## Comportamento Esperado

### Heartbeat HA (ha-003)
| Cenário | Evidência | Raw Data |
|---------|-----------|----------|
| HA = standalone | "N/A - HA não configurado" | Não exibido |
| HA ativo + 0 links | "❌ Nenhum link de heartbeat" | Exibido |
| HA ativo + 1 link | "⚠️ Apenas 1 link (ponto de falha)" | Exibido |
| HA ativo + 2+ links | "✅ N links configurados" | Exibido |

### Regras Any-to-Any (net-003)
| Cenário | Evidência | Raw Data |
|---------|-----------|----------|
| Nenhuma policy any-any | "✅ Nenhuma regra vulnerável encontrada" | Não exibido |
| 1+ policies any-any | "❌ N regra(s) encontrada(s)" + lista | Exibido com detalhes |
