

# Plano: Correção do Filtro de Regras UTM Security Profiles

## Resumo do Problema

As regras UTM estão analisando políticas incorretamente:

1. **Falta filtro `action = ACCEPT`** em todas as regras UTM
2. **utm-001 (IPS/IDS)** verifica interface de **destino** WAN, mas deveria verificar interface de **origem** WAN
3. Nome de utm-001 contém "(Inbound)" que pode ser removido

---

## Alterações Necessárias

### 1. Atualizar Nome da Regra no Banco de Dados

| Código | Nome Atual | Novo Nome |
|--------|------------|-----------|
| utm-001 | Security Profile - IPS/IDS (Inbound) | Security Profile - IPS/IDS |

### 2. Modificar `formatUTMSecurityProfileEvidence` na Edge Function

A função atual (linhas 785-886) precisa de duas correções:

```text
Alteração 1: Adicionar filtro action = ACCEPT
- Antes: analisa todas as policies ativas (status != 'disable')
- Depois: analisa apenas policies com action = 'accept'

Alteração 2: IPS/IDS deve verificar origem (srcintf), não destino (dstintf)
- utm-001: verificar srcintf (interface de ORIGEM é WAN/SD-WAN)
- utm-004, utm-007, utm-009: manter verificação de dstintf (interface de DESTINO é WAN/SD-WAN)
```

### 3. Código Proposto (supabase/functions/agent-task-result/index.ts)

```typescript
function formatUTMSecurityProfileEvidence(
  rawData: Record<string, unknown>,
  ruleCode: string
): { evidence: EvidenceItem[], vulnerablePolicies: Array<Record<string, unknown>> } {
  const evidence: EvidenceItem[] = [];
  const vulnerablePolicies: Array<Record<string, unknown>> = [];
  
  try {
    // Map rule code to corresponding profile field and interface direction
    const profileFieldMap: Record<string, { field: string, profileName: string, checkSource: boolean }> = {
      'utm-009': { field: 'av-profile', profileName: 'Antivirus', checkSource: false },        // Destino WAN
      'utm-007': { field: 'application-list', profileName: 'Application Control', checkSource: false }, // Destino WAN  
      'utm-004': { field: 'webfilter-profile', profileName: 'Web Filter', checkSource: false }, // Destino WAN
      'utm-001': { field: 'ips-sensor', profileName: 'IPS/IDS', checkSource: true }            // Origem WAN (inbound)
    };
    
    const profileConfig = profileFieldMap[ruleCode];
    if (!profileConfig) {
      evidence.push({ label: 'Erro', value: `Regra ${ruleCode} não mapeada`, type: 'text' });
      return { evidence, vulnerablePolicies };
    }
    
    const { field: profileField, profileName, checkSource } = profileConfig;
    
    // Get firewall policies and interfaces
    const policyData = rawData['firewall_policy'] as Record<string, unknown> | undefined;
    const interfaceData = rawData['system_interface'] as Record<string, unknown> | undefined;
    
    const policies = (policyData?.results || []) as Array<Record<string, unknown>>;
    const interfaces = (interfaceData?.results || []) as Array<Record<string, unknown>>;
    
    if (!policies.length) {
      evidence.push({ label: 'Status', value: 'Nenhuma política encontrada', type: 'text' });
      return { evidence, vulnerablePolicies };
    }
    
    // Analyze policies
    for (const policy of policies) {
      // Skip disabled policies
      if (policy.status === 'disable') continue;
      
      // NOVO: Skip policies where action is not ACCEPT
      const action = String(policy.action || '').toLowerCase();
      if (action !== 'accept') continue;
      
      // Check interface based on rule type
      let hasWanInterface = false;
      
      if (checkSource) {
        // For IPS/IDS (utm-001): check SOURCE interface is WAN/SD-WAN
        const srcintf = policy.srcintf as Array<Record<string, unknown>> | undefined;
        const srcintfNames = (srcintf || []).map(i => String(i.name || i.q_origin_key || ''));
        hasWanInterface = srcintfNames.some(name => isWanInterface(name, interfaces));
      } else {
        // For AV, AppCtrl, WebFilter: check DESTINATION interface is WAN/SD-WAN
        const dstintf = policy.dstintf as Array<Record<string, unknown>> | undefined;
        const dstintfNames = (dstintf || []).map(i => String(i.name || i.q_origin_key || ''));
        hasWanInterface = dstintfNames.some(name => isWanInterface(name, interfaces));
      }
      
      if (!hasWanInterface) continue; // Skip non-WAN interface policies
      
      // Check if the security profile is applied
      const profileValue = policy[profileField];
      const hasProfile = profileValue && String(profileValue).trim() !== '';
      
      if (!hasProfile) {
        vulnerablePolicies.push(policy);
      }
    }
    
    // Generate evidence
    const interfaceLabel = checkSource ? 'origem' : 'destino';
    
    if (vulnerablePolicies.length === 0) {
      evidence.push({
        label: 'Status',
        value: `✅ Todas as políticas ACCEPT com ${interfaceLabel} WAN possuem ${profileName}`,
        type: 'text'
      });
    } else {
      evidence.push({
        label: 'Status',
        value: `❌ ${vulnerablePolicies.length} política(s) ACCEPT sem ${profileName}`,
        type: 'text'
      });
      
      // Show details of problematic policies (max 5)
      for (const policy of vulnerablePolicies.slice(0, 5)) {
        const policyId = policy.policyid || policy.id || 'N/A';
        const policyName = policy.name || `Policy ${policyId}`;
        
        evidence.push({
          label: `Regra ${policyId}`,
          value: String(policyName),
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
    console.error('Error formatting UTM Security Profile evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
  }
  
  return { evidence, vulnerablePolicies };
}
```

### 4. Atualizar Exibição de Raw Data

Na seção de rawData (linha 1506-1514), incluir a interface correta baseada na regra:

```typescript
} else if (rule.code.startsWith('utm-') && utmResult && utmResult.vulnerablePolicies.length > 0) {
  const checkSource = rule.code === 'utm-001';
  checkRawData = {
    policies_sem_perfil: utmResult.vulnerablePolicies.map(p => ({
      policyid: p.policyid,
      name: p.name,
      // Incluir srcintf para IPS/IDS, dstintf para outros
      ...(checkSource 
        ? { srcintf: (p.srcintf as Array<Record<string, unknown>> || []).map(i => i.name || i.q_origin_key) }
        : { dstintf: (p.dstintf as Array<Record<string, unknown>> || []).map(i => i.name || i.q_origin_key) }
      )
    }))
  };
}
```

---

## Arquivos Modificados

1. **`supabase/functions/agent-task-result/index.ts`**
   - Modificar `formatUTMSecurityProfileEvidence` para:
     - Adicionar filtro `action = accept`
     - Verificar interface de origem (srcintf) para IPS/IDS
     - Verificar interface de destino (dstintf) para AV/AppCtrl/WebFilter
   - Atualizar rawData para incluir interface correta

2. **Migração de Banco de Dados**
   - Renomear utm-001 de "Security Profile - IPS/IDS (Inbound)" para "Security Profile - IPS/IDS"

---

## Resultado Esperado

### Antes (Problema)
```
Security Profile - Antivirus
  Evidências: [JSON bruto]
  Dados brutos: [JSON com todas as policies]
```

### Depois (Corrigido)

Para regras sem problemas:
```
Security Profile - IPS/IDS
  ✅ Todas as políticas ACCEPT com origem WAN possuem IPS/IDS
  [Sem dados brutos exibidos]
```

Para regras com problemas:
```
Security Profile - Antivirus
  ❌ 2 política(s) ACCEPT sem Antivirus
  Regra 15: VPN-to-Internet
  Regra 23: Guest-WiFi-Out
  [Dados brutos apenas das políticas problemáticas]
```

---

## Lógica de Filtragem por Regra

| Regra | Filtro Action | Interface Verificada | Perfil Verificado |
|-------|---------------|---------------------|-------------------|
| utm-001 (IPS/IDS) | ACCEPT | srcintf (Origem WAN) | ips-sensor |
| utm-004 (Web Filter) | ACCEPT | dstintf (Destino WAN) | webfilter-profile |
| utm-007 (App Control) | ACCEPT | dstintf (Destino WAN) | application-list |
| utm-009 (Antivirus) | ACCEPT | dstintf (Destino WAN) | av-profile |

---

## Complexidade

Baixa - Ajuste de lógica condicional na função existente + renomeação no banco

