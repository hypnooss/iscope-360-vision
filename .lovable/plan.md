
# Plano: Correção de Evidências HA Heartbeat e Regras Any-to-Any

## Resumo Executivo

Corrigir a exibição de evidências para duas verificações de compliance no FortiGate:
1. **Heartbeat HA (ha-003)**: Não exibir dados de heartbeat quando HA está desabilitado
2. **Regras Any-to-Any (net-003)**: Implementar formatador específico seguindo padrão das regras inb-*

---

## Problema 1: Heartbeat HA (ha-003)

### Situacao Atual
- A regra `ha-003` avalia `results.hbdev` do endpoint `system_ha`
- Não existe formatador específico para esta regra
- Está usando o formatador genérico que exibe o valor bruto de `hbdev`
- Mesmo com HA em modo `standalone`, exibe dados de heartbeat

### Lógica Correta
- **Se HA mode = standalone**: Status "N/A - HA não configurado", sem rawData
- **Se HA mode != standalone E hbdev configurado**: Verificar quantidade de interfaces de heartbeat
- **Se múltiplos links**: Pass - "Múltiplos links de heartbeat configurados"
- **Se apenas 1 link**: Warning - "Link único de heartbeat (ponto de falha)"

---

## Problema 2: Regras Any-to-Any (net-003)

### Situacao Atual
- A regra `net-003` avalia policies com `srcaddr=all` E `dstaddr=all`
- Não existe formatador específico
- Usa formatador genérico que exibe JSON estranho/truncado

### Lógica Correta (seguir padrão inb-*)
- Analisar todas as policies do firewall_policy
- Encontrar policies onde AMBOS:
  - srcaddr contém objeto "all"
  - dstaddr contém objeto "all"
- **Se encontrar**: Exibir ID e Nome de cada policy vulnerável + rawData
- **Se não encontrar**: "Nenhuma regra vulnerável encontrada" SEM rawData

---

## Alteracoes Tecnicas

### Arquivo: supabase/functions/agent-task-result/index.ts

#### 1. Novo Formatador: formatHAHeartbeatEvidence

Criar função após `formatHAEvidence` (linha ~568):

```typescript
function formatHAHeartbeatEvidence(rawData: Record<string, unknown>): {
  evidence: EvidenceItem[],
  status: 'pass' | 'fail' | 'warn' | 'unknown',
  skipRawData: boolean
} {
  const evidence: EvidenceItem[] = [];

  try {
    const haData = rawData['system_ha'] as Record<string, unknown> | undefined;
    if (!haData) {
      return {
        evidence: [{ label: 'HA', value: 'Dados não disponíveis', type: 'text' }],
        status: 'unknown',
        skipRawData: true
      };
    }

    const results = haData.results as Record<string, unknown> || haData;
    const mode = results.mode as string || 'standalone';

    // Se HA não está configurado, não faz sentido verificar heartbeat
    if (mode === 'standalone') {
      evidence.push({
        label: 'Status',
        value: 'N/A - HA não configurado',
        type: 'text'
      });
      return { evidence, status: 'unknown', skipRawData: true };
    }

    // HA está ativo - verificar heartbeat devices
    const hbdev = results.hbdev as string | undefined;

    if (!hbdev || hbdev === '' || hbdev === '""') {
      evidence.push({
        label: 'Status',
        value: '❌ Nenhum link de heartbeat configurado',
        type: 'text'
      });
      return { evidence, status: 'fail', skipRawData: false };
    }

    // Contar interfaces de heartbeat (separadas por espaço ou vírgula)
    const interfaces = hbdev.split(/[\s,]+/).filter(Boolean);
    const count = interfaces.length;

    if (count >= 2) {
      evidence.push({
        label: 'Status',
        value: `✅ ${count} links de heartbeat configurados`,
        type: 'text'
      });
      evidence.push({
        label: 'Interfaces',
        value: interfaces.join(', '),
        type: 'code'
      });
      return { evidence, status: 'pass', skipRawData: false };
    } else {
      evidence.push({
        label: 'Status',
        value: `⚠️ Apenas 1 link de heartbeat (ponto de falha)`,
        type: 'text'
      });
      evidence.push({
        label: 'Interface',
        value: interfaces[0] || hbdev,
        type: 'code'
      });
      return { evidence, status: 'warn', skipRawData: false };
    }
  } catch (e) {
    console.error('Error formatting HA Heartbeat evidence:', e);
    return {
      evidence: [{ label: 'Erro', value: 'Falha ao processar dados', type: 'text' }],
      status: 'unknown',
      skipRawData: true
    };
  }
}
```

#### 2. Novo Formatador: formatAnyToAnyEvidence

Criar função após `formatInboundRuleEvidence` (linha ~900):

```typescript
function formatAnyToAnyEvidence(rawData: Record<string, unknown>): {
  evidence: EvidenceItem[],
  vulnerablePolicies: Array<Record<string, unknown>>
} {
  const evidence: EvidenceItem[] = [];
  const vulnerablePolicies: Array<Record<string, unknown>> = [];

  try {
    const policyData = rawData['firewall_policy'] as Record<string, unknown> | undefined;
    const policies = (policyData?.results || []) as Array<Record<string, unknown>>;

    if (!policies.length) {
      evidence.push({ label: 'Status', value: 'Nenhuma política encontrada', type: 'text' });
      return { evidence, vulnerablePolicies };
    }

    // Verificar cada policy para any-to-any
    for (const policy of policies) {
      const srcaddr = policy.srcaddr as Array<Record<string, unknown>> | undefined;
      const dstaddr = policy.dstaddr as Array<Record<string, unknown>> | undefined;

      const hasAllSource = (srcaddr || []).some(
        addr => String(addr.name || addr.q_origin_key || '').toLowerCase() === 'all'
      );
      const hasAllDest = (dstaddr || []).some(
        addr => String(addr.name || addr.q_origin_key || '').toLowerCase() === 'all'
      );

      if (hasAllSource && hasAllDest) {
        vulnerablePolicies.push(policy);
      }
    }

    // Gerar evidências
    if (vulnerablePolicies.length === 0) {
      evidence.push({
        label: 'Status',
        value: '✅ Nenhuma regra vulnerável encontrada',
        type: 'text'
      });
    } else {
      evidence.push({
        label: 'Status',
        value: `❌ ${vulnerablePolicies.length} regra(s) any-any encontrada(s)`,
        type: 'text'
      });

      // Detalhar até 5 policies
      for (const policy of vulnerablePolicies.slice(0, 5)) {
        const policyId = policy.policyid || policy.id || 'N/A';
        const policyName = policy.name || `Policy ${policyId}`;
        const action = policy.action || 'N/A';
        const status = policy.status === 'enable' ? '🟢' : '🔴';

        evidence.push({
          label: `Regra ${policyId}`,
          value: `${status} ${policyName} (${String(action).toUpperCase()})`,
          type: 'text'
        });
      }

      if (vulnerablePolicies.length > 5) {
        evidence.push({
          label: 'Aviso',
          value: `... e mais ${vulnerablePolicies.length - 5} regra(s)`,
          type: 'text'
        });
      }
    }
  } catch (e) {
    console.error('Error formatting Any-to-Any evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
  }

  return { evidence, vulnerablePolicies };
}
```

#### 3. Integrar no processComplianceRules

No switch de formatadores (linhas ~990-1036), adicionar:

```typescript
} else if (rule.code === 'ha-003') {
  // HA Heartbeat - verificar apenas se HA está configurado
  const haHeartbeatResult = formatHAHeartbeatEvidence(rawData);
  evidence = haHeartbeatResult.evidence;
  status = haHeartbeatResult.status;
  if (haHeartbeatResult.skipRawData) {
    // Não incluir rawData quando HA não está configurado
    checkRawData = {};
  }
} else if (rule.code === 'net-003') {
  // Regras Any-to-Any
  const anyToAnyResult = formatAnyToAnyEvidence(rawData);
  evidence = anyToAnyResult.evidence;
  if (anyToAnyResult.vulnerablePolicies.length > 0) {
    status = 'fail';
    details = rule.fail_description || 'Regras any-any detectadas';
  } else {
    status = 'pass';
    details = rule.pass_description || 'Nenhuma regra any-any encontrada';
  }
}
```

#### 4. Atualizar Logica de rawData

Na seção de `checkRawData` (linhas ~1039-1103), adicionar:

```typescript
} else if (rule.code === 'net-003' && anyToAnyResult && anyToAnyResult.vulnerablePolicies.length > 0) {
  // Só incluir rawData quando há policies any-any
  checkRawData = {
    policies_any_any: anyToAnyResult.vulnerablePolicies.map(p => ({
      policyid: p.policyid,
      name: p.name,
      srcaddr: p.srcaddr,
      dstaddr: p.dstaddr,
      service: p.service,
      action: p.action,
      status: p.status
    }))
  };
}
// Para net-003 sem policies vulneráveis, não inclui rawData (já tratado)
```

---

## Comportamento Esperado Após Correções

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

---

## Arquivos Modificados
- `supabase/functions/agent-task-result/index.ts`

## Estimativa
- Complexidade: Média
- Linhas de código: ~150 novas linhas
