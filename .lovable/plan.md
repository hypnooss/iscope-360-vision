
# Plano: Correção das Verificações de Segurança de Interfaces

## Resumo do Problema

Na categoria "Segurança de Interfaces", as regras `int-001`, `int-002` e `int-003` estão exibindo dados incorretos:

| Regra Atual | Problema | Objetivo |
|-------------|----------|----------|
| int-001 (Protocolo HTTP na Interface de Gerência) | Exibe dados brutos completos da interface ao invés de filtrar por protocolo | Encontrar interfaces **WAN** com **HTTP** no campo `allowaccess` |
| int-002 (Protocolo Telnet Ativo) | Mesmo problema - exibe todos os dados da interface | Encontrar interfaces **WAN** com **HTTPS** (renomear) no campo `allowaccess` |
| int-003 (SSH em Interface Externa) | Mesmo problema | Encontrar interfaces **WAN** com **SSH** no campo `allowaccess` |

Além disso, precisamos criar duas novas regras:
- **SNMP em Interfaces Externas** - verificar protocolo SNMP em interfaces WAN
- **ICMP em Interfaces Externas** - verificar protocolo Ping em interfaces WAN

---

## Alterações Necessárias

### 1. Renomear Regras Existentes no Banco de Dados

| Código | Nome Atual | Novo Nome |
|--------|------------|-----------|
| int-001 | Protocolo HTTP na Interface de Gerência | Protocolo HTTP em Interfaces Externas |
| int-002 | Protocolo Telnet Ativo | Protocolo HTTPS em Interfaces Externas |
| int-003 | SSH em Interface Externa | Protocolo SSH em Interfaces Externas |

### 2. Criar Novas Regras de Compliance

| Código | Nome | Protocolo Verificado | Severidade |
|--------|------|---------------------|------------|
| int-004 | Protocolo SNMP em Interfaces Externas | snmp | medium |
| int-005 | Protocolo ICMP em Interfaces Externas | ping | low |

### 3. Criar Formatador `formatInterfaceSecurityEvidence`

Nova função na Edge Function para processar regras `int-*`:

```typescript
function formatInterfaceSecurityEvidence(
  rawData: Record<string, unknown>,
  ruleCode: string
): { evidence: EvidenceItem[], vulnerableInterfaces: Array<Record<string, unknown>>, status: 'pass' | 'fail' | 'warn' } {
  const evidence: EvidenceItem[] = [];
  const vulnerableInterfaces: Array<Record<string, unknown>> = [];
  
  try {
    // Mapear código de regra para protocolo verificado
    const protocolMap: Record<string, { protocol: string, protocolLabel: string }> = {
      'int-001': { protocol: 'http', protocolLabel: 'HTTP' },
      'int-002': { protocol: 'https', protocolLabel: 'HTTPS' },
      'int-003': { protocol: 'ssh', protocolLabel: 'SSH' },
      'int-004': { protocol: 'snmp', protocolLabel: 'SNMP' },
      'int-005': { protocol: 'ping', protocolLabel: 'ICMP Ping' }
    };
    
    const config = protocolMap[ruleCode];
    if (!config) {
      evidence.push({ label: 'Erro', value: `Regra ${ruleCode} não mapeada`, type: 'text' });
      return { evidence, vulnerableInterfaces, status: 'pass' };
    }
    
    // Obter lista de interfaces
    const interfaceData = rawData['system_interface'] as Record<string, unknown> | undefined;
    const interfaces = ((interfaceData?.results || []) as Array<Record<string, unknown>>);
    
    if (!interfaces.length) {
      evidence.push({ label: 'Status', value: 'Nenhuma interface encontrada', type: 'text' });
      return { evidence, vulnerableInterfaces, status: 'pass' };
    }
    
    // Analisar interfaces
    for (const iface of interfaces) {
      const role = String(iface.role || '').toLowerCase();
      const name = String(iface.name || '');
      const allowaccess = String(iface.allowaccess || '').toLowerCase();
      
      // Verificar se é interface WAN ou SD-WAN
      const isWan = role === 'wan' || role === 'sd-wan' || 
                    role.includes('wan') || 
                    name.toLowerCase().includes('wan') ||
                    name.toLowerCase().includes('sdwan');
      
      if (!isWan) continue;
      
      // Para int-001 (HTTP), verificar se tem 'http' mas NÃO 'https'
      // Para outras regras, verificar se o protocolo está presente
      let hasProtocol = false;
      
      if (ruleCode === 'int-001') {
        // HTTP: verificar 'http' sem ser 'https'
        const protocols = allowaccess.split(/\s+/);
        hasProtocol = protocols.some(p => p === 'http');
      } else {
        hasProtocol = allowaccess.includes(config.protocol);
      }
      
      if (hasProtocol) {
        vulnerableInterfaces.push(iface);
      }
    }
    
    // Gerar evidências
    if (vulnerableInterfaces.length === 0) {
      evidence.push({
        label: 'Status',
        value: `✅ Nenhuma interface WAN com ${config.protocolLabel} habilitado`,
        type: 'text'
      });
    } else {
      evidence.push({
        label: 'Status',
        value: `❌ ${vulnerableInterfaces.length} interface(s) WAN com ${config.protocolLabel} habilitado`,
        type: 'text'
      });
      
      // Mostrar nomes das interfaces (max 5)
      for (const iface of vulnerableInterfaces.slice(0, 5)) {
        const name = iface.name || 'N/A';
        const allowaccess = iface.allowaccess || '';
        evidence.push({
          label: String(name),
          value: `allowaccess: ${allowaccess}`,
          type: 'code'
        });
      }
      
      if (vulnerableInterfaces.length > 5) {
        evidence.push({
          label: 'Aviso',
          value: `... e mais ${vulnerableInterfaces.length - 5} interface(s)`,
          type: 'text'
        });
      }
    }
    
    const status = vulnerableInterfaces.length > 0 ? 'fail' : 'pass';
    return { evidence, vulnerableInterfaces, status };
    
  } catch (e) {
    console.error('Error formatting interface security evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
    return { evidence, vulnerableInterfaces, status: 'pass' };
  }
}
```

### 4. Integrar Formatador no Processamento (linha ~1515)

```typescript
} else if (rule.code.startsWith('int-')) {
  // Interface Security rules (int-001, int-002, int-003, int-004, int-005)
  intResult = formatInterfaceSecurityEvidence(rawData, rule.code);
  evidence = intResult.evidence;
  status = intResult.status;
  if (status === 'pass') {
    details = rule.pass_description || 'Nenhuma interface WAN com protocolo inseguro';
  } else {
    details = rule.fail_description || `${intResult.vulnerableInterfaces.length} interface(s) vulnerável(is)`;
  }
}
```

### 5. Controlar Raw Data (linha ~1652)

```typescript
} else if (rule.code.startsWith('int-') && intResult && intResult.vulnerableInterfaces.length > 0) {
  // Para regras de interface, só incluir rawData quando há interfaces vulneráveis
  checkRawData = {
    interfaces_vulneraveis: intResult.vulnerableInterfaces.map(i => ({
      name: i.name,
      role: i.role,
      allowaccess: i.allowaccess
    }))
  };
}
```

### 6. Declarar Variável `intResult` (linha ~1421)

```typescript
let intResult: { evidence: EvidenceItem[], vulnerableInterfaces: Array<Record<string, unknown>>, status: 'pass' | 'fail' | 'warn' } | null = null;
```

---

## Arquivos Modificados

1. **`supabase/functions/agent-task-result/index.ts`**
   - Adicionar função `formatInterfaceSecurityEvidence`
   - Integrar no switch de processamento de regras (após sec-*)
   - Controlar exibição de rawData para int-*
   - Declarar variável `intResult`

2. **Migração de Banco de Dados (SQL)**
   - Renomear int-001, int-002, int-003
   - Criar int-004 (SNMP) e int-005 (ICMP Ping)

---

## SQL para Migração

```sql
-- Renomear regras existentes
UPDATE compliance_rules SET name = 'Protocolo HTTP em Interfaces Externas' WHERE code = 'int-001';
UPDATE compliance_rules SET name = 'Protocolo HTTPS em Interfaces Externas' WHERE code = 'int-002';
UPDATE compliance_rules SET name = 'Protocolo SSH em Interfaces Externas' WHERE code = 'int-003';

-- Criar regra SNMP
INSERT INTO compliance_rules (
  code, name, category, severity, weight,
  description, recommendation,
  pass_description, fail_description,
  evaluation_logic, device_type_id
)
SELECT 
  'int-004', 'Protocolo SNMP em Interfaces Externas', 'Segurança de Interfaces', 'medium', 2,
  'Verifica se SNMP está habilitado em interfaces WAN', 
  'Restringir SNMP apenas a interfaces internas ou IPs de gerenciamento confiáveis',
  'SNMP não exposto em interfaces WAN',
  'SNMP habilitado em interfaces WAN - risco de enumeração de rede',
  '{"source_key": "system_interface", "field_path": "results", "conditions": [{"operator": "none_match", "field": "allowaccess", "contains": "snmp", "result": "pass"}, {"operator": "any_match", "field": "allowaccess", "contains": "snmp", "result": "warning"}], "default_result": "pass"}'::jsonb,
  device_type_id
FROM compliance_rules WHERE code = 'int-001' LIMIT 1;

-- Criar regra ICMP Ping
INSERT INTO compliance_rules (
  code, name, category, severity, weight,
  description, recommendation,
  pass_description, fail_description,
  evaluation_logic, device_type_id
)
SELECT 
  'int-005', 'Protocolo ICMP em Interfaces Externas', 'Segurança de Interfaces', 'low', 1,
  'Verifica se ICMP Ping está habilitado em interfaces WAN', 
  'Considerar desabilitar Ping em interfaces WAN para reduzir superfície de ataque',
  'Ping desabilitado em interfaces WAN',
  'Ping habilitado em interfaces WAN - permite descoberta de host',
  '{"source_key": "system_interface", "field_path": "results", "conditions": [{"operator": "none_match", "field": "allowaccess", "contains": "ping", "result": "pass"}, {"operator": "any_match", "field": "allowaccess", "contains": "ping", "result": "warning"}], "default_result": "pass"}'::jsonb,
  device_type_id
FROM compliance_rules WHERE code = 'int-001' LIMIT 1;
```

---

## Resultado Esperado

### Antes (Problema)
```
Protocolo HTTP na Interface de Gerência
  Evidências: [JSON bruto completo com IP, MTU, IPv6, etc.]
  Dados brutos: { "results": [ ... todos os dados ... ] }
```

### Depois (Corrigido)

**Quando não há interfaces vulneráveis:**
```
Protocolo HTTP em Interfaces Externas
  ✅ Nenhuma interface WAN com HTTP habilitado
  [Sem dados brutos]
```

**Quando há interfaces vulneráveis:**
```
Protocolo SSH em Interfaces Externas
  ❌ 1 interface(s) WAN com SSH habilitado
  wan1: allowaccess: ping https ssh
  [Dados brutos apenas das interfaces vulneráveis com name, role e allowaccess]
```

---

## Lógica de Verificação por Regra

| Regra | Protocolo | Campo Verificado | Condição |
|-------|-----------|------------------|----------|
| int-001 | HTTP | allowaccess | Contém 'http' (exceto 'https') |
| int-002 | HTTPS | allowaccess | Contém 'https' |
| int-003 | SSH | allowaccess | Contém 'ssh' |
| int-004 | SNMP | allowaccess | Contém 'snmp' |
| int-005 | Ping | allowaccess | Contém 'ping' |

Todas as regras filtram apenas interfaces com `role = 'wan'` ou `role = 'sd-wan'` ou nome contendo 'wan'/'sdwan'.

---

## Complexidade

Média - Criação de formatador especializado + 2 novas regras no banco + renomeação
