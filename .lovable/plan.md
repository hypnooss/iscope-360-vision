

# Plano: Melhorar Formatadores de Evidências para Políticas de Segurança

## Resumo do Problema

Na categoria "Políticas de Segurança", três regras precisam de melhorias:

| Regra | Problema Identificado |
|-------|----------------------|
| **sec-002 (2FA)** | Exibe `results: []` - A API do FortiGate não retorna administradores devido a limitações de permissões do API token |
| **sec-001 (Criptografia Forte)** | Exibe `results.strong-crypto enable` - Formato técnico pouco amigável |
| **sec-003 (Timeout de Sessão)** | Exibe `results.admintimeout 5` - Formato técnico pouco amigável |

---

## Análise Técnica

### sec-002 (Autenticação de Dois Fatores)

**Causa raiz:** O endpoint `/api/v2/cmdb/system/admin` retorna `results: []` e `matched_count: 0` porque:
- O API token FortiGate geralmente é gerado para um administrador específico
- Por segurança, cada admin só pode ver suas próprias configurações, não de outros admins
- Isso é uma limitação de segurança do FortiOS, não um bug

**Solução:** 
- Criar formatador especializado que reconheça quando `results` está vazio
- Exibir mensagem informativa explicando a limitação
- Ajustar status para "unknown" quando não há dados para avaliar

### sec-001 (Criptografia Forte) e sec-003 (Timeout de Sessão)

**Causa raiz:** Usam `formatGenericEvidence` que exibe o valor bruto sem formatação.

**Solução:** Criar formatador especializado `formatSecurityPolicyEvidence` que:
- Apresente as informações de forma clara e amigável
- Use ícones de status (✅/❌) para indicar conformidade
- Esconda raw data quando o valor já está claro nas evidências

---

## Alterações Necessárias

### 1. Criar Formatador `formatSecurityPolicyEvidence`

Nova função na Edge Function para formatar sec-001, sec-002, sec-003:

```typescript
function formatSecurityPolicyEvidence(
  rawData: Record<string, unknown>,
  ruleCode: string
): { evidence: EvidenceItem[], status?: 'pass' | 'fail' | 'warn' | 'unknown', skipRawData?: boolean } {
  
  if (ruleCode === 'sec-001') {
    // Criptografia Forte
    const globalData = rawData['system_global']?.results || rawData['system_global'];
    const strongCrypto = globalData?.['strong-crypto'];
    
    if (strongCrypto === 'enable') {
      return {
        evidence: [{ label: 'Criptografia Forte', value: '✅ Habilitada', type: 'text' }],
        status: 'pass',
        skipRawData: true
      };
    } else {
      return {
        evidence: [{ label: 'Criptografia Forte', value: '❌ Desabilitada', type: 'text' }],
        status: 'fail',
        skipRawData: false
      };
    }
  }
  
  if (ruleCode === 'sec-002') {
    // Autenticação de Dois Fatores
    const adminData = rawData['system_admin'];
    const results = adminData?.results || [];
    
    if (results.length === 0) {
      return {
        evidence: [
          { label: 'Status', value: '⚠️ Dados de administradores não disponíveis', type: 'text' },
          { label: 'Motivo', value: 'API token sem permissão para listar administradores', type: 'text' },
          { label: 'Ação Recomendada', value: 'Verifique manualmente no painel FortiGate', type: 'text' }
        ],
        status: 'unknown',
        skipRawData: true
      };
    }
    
    // Verificar 2FA em cada admin
    const adminsWithout2FA = results.filter(admin => 
      admin['two-factor'] === 'disable' || !admin['two-factor']
    );
    
    if (adminsWithout2FA.length === 0) {
      return {
        evidence: [{ label: 'Status', value: '✅ Todos os administradores com 2FA', type: 'text' }],
        status: 'pass',
        skipRawData: true
      };
    } else {
      const evidence = [
        { label: 'Status', value: `❌ ${adminsWithout2FA.length} admin(s) sem 2FA`, type: 'text' }
      ];
      for (const admin of adminsWithout2FA.slice(0, 5)) {
        evidence.push({ label: 'Admin', value: admin.name || 'N/A', type: 'text' });
      }
      return { evidence, status: 'fail', skipRawData: false };
    }
  }
  
  if (ruleCode === 'sec-003') {
    // Timeout de Sessão
    const globalData = rawData['system_global']?.results || rawData['system_global'];
    const timeout = globalData?.admintimeout;
    
    if (timeout !== undefined) {
      const isCompliant = timeout <= 30;
      return {
        evidence: [
          { label: 'Timeout de Sessão', value: `${timeout} minutos`, type: 'text' },
          { label: 'Status', value: isCompliant ? '✅ Configuração adequada' : '⚠️ Timeout muito longo', type: 'text' }
        ],
        status: isCompliant ? 'pass' : 'warn',
        skipRawData: true
      };
    }
  }
  
  return { evidence: [], skipRawData: false };
}
```

### 2. Integrar Formatador no Processamento

Adicionar branch no switch de regras (após linha ~1402):

```typescript
} else if (rule.code.startsWith('sec-')) {
  // Security Policy rules (sec-001, sec-002, sec-003)
  const secResult = formatSecurityPolicyEvidence(rawData, rule.code);
  if (secResult.evidence.length > 0) {
    evidence = secResult.evidence;
    if (secResult.status) {
      status = secResult.status;
      if (status === 'pass') {
        details = rule.pass_description || 'Configuração de segurança adequada';
      } else if (status === 'fail' || status === 'warn') {
        details = rule.fail_description || 'Verificar configuração de segurança';
      } else if (status === 'unknown') {
        details = 'Não foi possível verificar - dados indisponíveis';
      }
    }
  }
}
```

### 3. Controlar Raw Data para Regras sec-*

Adicionar lógica para suprimir rawData quando `skipRawData: true`:

```typescript
} else if (rule.code.startsWith('sec-') && secResult && !secResult.skipRawData) {
  // Só incluir rawData se não foi suprimido
  const sourceKey = logic.source_key || '';
  const data = rawData[sourceKey];
  if (data) {
    checkRawData[sourceKey] = data;
  }
}
```

---

## Arquivos Modificados

1. **`supabase/functions/agent-task-result/index.ts`**
   - Adicionar função `formatSecurityPolicyEvidence`
   - Integrar no switch de processamento de regras
   - Controlar exibição de rawData

---

## Resultado Esperado

### sec-002 (Autenticação de Dois Fatores) - Antes
```
❌ Falha
Evidências: []
Dados brutos: {"results": []}
```

### sec-002 (Autenticação de Dois Fatores) - Depois
```
⚠️ Desconhecido
  Status: ⚠️ Dados de administradores não disponíveis
  Motivo: API token sem permissão para listar administradores
  Ação Recomendada: Verifique manualmente no painel FortiGate
[Sem dados brutos]
```

### sec-001 (Criptografia Forte) - Antes
```
✅ Aprovado
Evidências: results.strong-crypto enable
Dados brutos: {"results.strong-crypto": "enable"}
```

### sec-001 (Criptografia Forte) - Depois
```
✅ Aprovado
  Criptografia Forte: ✅ Habilitada
[Sem dados brutos]
```

### sec-003 (Timeout de Sessão) - Antes
```
✅ Aprovado
Evidências: results.admintimeout 5
Dados brutos: {"results.admintimeout": 5}
```

### sec-003 (Timeout de Sessão) - Depois
```
✅ Aprovado
  Timeout de Sessão: 5 minutos
  Status: ✅ Configuração adequada
[Sem dados brutos]
```

---

## Complexidade

Baixa - Criação de formatador especializado seguindo padrão existente

