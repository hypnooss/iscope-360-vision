

# Plano: Correção das Regras UTM de Security Profiles

## Resumo do Problema

As regras de compliance UTM (Antivírus, Web Filter, Application Control) estão exibindo JSON bruto nas evidências porque:

1. **Não há formatadores especializados** para regras `utm-*` na Edge Function
2. A lógica de avaliação no banco está verificando interface de destino, mas falta formatador para exibir corretamente
3. A regra `utm-001` (IPS/IDS) está na categoria errada - deveria estar em "Regras de Entrada"

---

## Alterações Necessárias

### 1. Atualizar Nomes e Categorias no Banco de Dados

| Código | Nome Atual | Novo Nome | Categoria |
|--------|------------|-----------|-----------|
| utm-001 | Perfil IPS/IDS Ativo (Inbound WAN) | Security Profile - IPS/IDS (Inbound) | Regras de Entrada |
| utm-004 | Web Filter Ativo | Security Profile - Web Filter | Perfis de Segurança UTM |
| utm-007 | Application Control Ativo | Security Profile - Application Control | Perfis de Segurança UTM |
| utm-009 | Antivírus de Gateway | Security Profile - Antivirus | Perfis de Segurança UTM |

### 2. Criar Formatador Especializado para Regras UTM

Adicionar função `formatUTMSecurityProfileEvidence` na Edge Function:

```typescript
function formatUTMSecurityProfileEvidence(
  rawData: Record<string, unknown>,
  ruleCode: string
): { 
  evidence: EvidenceItem[], 
  vulnerablePolicies: Array<Record<string, unknown>> 
} {
  // Mapear código da regra para o campo de perfil correspondente
  const profileFieldMap: Record<string, string> = {
    'utm-009': 'av-profile',        // Antivírus
    'utm-007': 'application-list',   // Application Control  
    'utm-004': 'webfilter-profile',  // Web Filter
    'utm-001': 'ips-sensor'          // IPS/IDS
  };
  
  const profileField = profileFieldMap[ruleCode];
  
  // Buscar políticas e interfaces
  const policies = rawData.firewall_policy?.results || [];
  const interfaces = rawData.system_interface?.results || [];
  
  // Identificar interfaces WAN/SD-WAN
  const wanInterfaces = interfaces.filter(isWan).map(i => i.name);
  
  // Filtrar políticas vulneráveis:
  // - Interface de DESTINO é WAN/SD-WAN
  // - NÃO tem o perfil de segurança aplicado
  const vulnerablePolicies = policies.filter(policy => {
    const dstintfNames = policy.dstintf.map(i => i.name);
    const isDestinationWan = dstintfNames.some(isWanInterface);
    const hasProfile = policy[profileField] && policy[profileField] !== '';
    
    return isDestinationWan && !hasProfile;
  });
  
  // Gerar evidências formatadas
  if (vulnerablePolicies.length === 0) {
    return {
      evidence: [{ label: 'Status', value: '✅ Todas as políticas WAN possuem perfil', type: 'text' }],
      vulnerablePolicies: []
    };
  }
  
  // Listar políticas sem perfil
  const evidence = [
    { label: 'Status', value: `❌ ${vulnerablePolicies.length} política(s) sem perfil`, type: 'text' }
  ];
  
  for (const policy of vulnerablePolicies.slice(0, 5)) {
    evidence.push({
      label: `Regra ${policy.policyid}`,
      value: policy.name || `Policy ${policy.policyid}`,
      type: 'text'
    });
  }
  
  return { evidence, vulnerablePolicies };
}
```

### 3. Integrar Formatador no Processamento de Regras

Na função `processComplianceRules`, adicionar branch para regras UTM:

```typescript
} else if (rule.code.startsWith('utm-')) {
  // UTM Security Profiles
  const utmResult = formatUTMSecurityProfileEvidence(rawData, rule.code);
  evidence = utmResult.evidence;
  
  if (utmResult.vulnerablePolicies.length > 0) {
    status = 'fail';
    details = rule.fail_description || `${utmResult.vulnerablePolicies.length} política(s) sem perfil de segurança`;
  } else {
    status = 'pass';
    details = rule.pass_description || 'Todas as políticas WAN possuem perfil';
  }
}
```

### 4. Controlar exibição de Raw Data

Adicionar lógica para só exibir rawData quando houver políticas vulneráveis:

```typescript
} else if (rule.code.startsWith('utm-') && utmResult && utmResult.vulnerablePolicies.length > 0) {
  checkRawData = {
    policies_sem_perfil: utmResult.vulnerablePolicies.map(p => ({
      policyid: p.policyid,
      name: p.name,
      dstintf: p.dstintf
    }))
  };
}
```

---

## Arquivos Modificados

1. **`supabase/functions/agent-task-result/index.ts`**
   - Adicionar função `formatUTMSecurityProfileEvidence`
   - Integrar no switch de processamento de regras
   - Controlar exibição de rawData para regras UTM

2. **Migração de Banco de Dados**
   - Renomear regras UTM
   - Mover `utm-001` para categoria "Regras de Entrada"

---

## Resultado Esperado

### Antes (Problema)
```
Antivírus de Gateway
  Evidências: [JSON bruto com todas as políticas]
  Dados brutos: [JSON enorme]
```

### Depois (Corrigido)
```
Security Profile - Antivirus
  ✅ Todas as políticas WAN possuem perfil
  [Sem dados brutos exibidos]
```

Ou se houver problemas:
```
Security Profile - Antivirus
  ❌ 2 política(s) sem perfil
  Regra 15: VPN-to-Internet
  Regra 23: Guest-WiFi-Out
  [Dados brutos apenas das políticas problemáticas]
```

---

## Complexidade

Média - Criação de formatador especializado + atualização de banco

