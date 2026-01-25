
# Plano: Corrigir Exibição de Evidências para FortiCare e Backup

## Problemas Identificados

### 1. FortiCare (lic-001) - Faltando dados brutos JSON
O formatador `formatFortiCareEvidence` gera as evidências formatadas corretamente, mas o `rawData` está sendo preenchido apenas com o campo `field_path` específico (linha 709-711), não com os dados completos do `license_status`.

### 2. Backup (bkp-001) - Não mostra endpoint nem evidências  
O código do formatador verifica `backup-001`, mas a regra no banco usa `bkp-001`. Além disso:
- O `source_key` da regra é `system_automation_stitch` (não `system_global`)
- O formatador atual lê `system_global` que não é o fonte correto

---

## Solução

### Arquivo: `supabase/functions/agent-task-result/index.ts`

#### Mudança 1: Incluir rawData completo para regras de licenciamento

Na geração de rawData (linhas 707-711), adicionar lógica para incluir todos os dados relevantes para regras específicas:

```typescript
// Incluir dados brutos relevantes
let checkRawData: Record<string, unknown> = {};

// Para regras de licenciamento, incluir dados completos do license_status
if (rule.code === 'lic-001' || rule.code === 'lic-002') {
  const licenseData = rawData['license_status'];
  if (licenseData) {
    checkRawData = { license_status: licenseData };
  }
} else if (rule.code === 'bkp-001') {
  // Incluir dados de automação para backup
  checkRawData = {
    system_automation_stitch: rawData['system_automation_stitch'],
    system_automation_trigger: rawData['system_automation_trigger'],
    system_automation_action: rawData['system_automation_action']
  };
} else if (logic.field_path && value !== undefined) {
  checkRawData[logic.field_path] = value;
}
```

#### Mudança 2: Corrigir código da regra de backup no formatador

Linha 699: Trocar `backup-001` por `bkp-001`:

```typescript
} else if (rule.code === 'bkp-001') {
  // Backup
  evidence = formatBackupEvidence(rawData);
}
```

#### Mudança 3: Atualizar formatador de Backup para usar dados corretos

O formatador `formatBackupEvidence` (linhas 568-591) deve usar `system_automation_stitch` em vez de `system_global`:

```typescript
function formatBackupEvidence(rawData: Record<string, unknown>): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  
  try {
    // Verificar automações de backup
    const stitchData = rawData['system_automation_stitch'] as Record<string, unknown> | undefined;
    const triggerData = rawData['system_automation_trigger'] as Record<string, unknown> | undefined;
    const actionData = rawData['system_automation_action'] as Record<string, unknown> | undefined;
    
    // Verificar se há ações de backup configuradas
    const actions = (actionData?.results || []) as Array<Record<string, unknown>>;
    const backupActions = actions.filter(a => 
      a['action-type'] === 'backup' || 
      a['action-type'] === 'config-backup' ||
      String(a.name || '').toLowerCase().includes('backup')
    );
    
    // Verificar triggers agendados
    const triggers = (triggerData?.results || []) as Array<Record<string, unknown>>;
    const scheduledTriggers = triggers.filter(t => 
      t['trigger-type'] === 'scheduled' || 
      t['trigger-type'] === 'event-based'
    );
    
    // Verificar stitches que combinam trigger + action de backup
    const stitches = (stitchData?.results || []) as Array<Record<string, unknown>>;
    
    if (backupActions.length > 0 && scheduledTriggers.length > 0) {
      evidence.push({
        label: 'Status',
        value: '✅ Backup automático configurado',
        type: 'text'
      });
      
      // Listar ações de backup encontradas
      for (const action of backupActions.slice(0, 3)) {
        evidence.push({
          label: 'Ação',
          value: String(action.name || 'backup'),
          type: 'code'
        });
      }
      
      // Listar triggers agendados
      for (const trigger of scheduledTriggers.slice(0, 3)) {
        const schedule = trigger['trigger-datetime'] || trigger.schedule || 'N/A';
        evidence.push({
          label: 'Agendamento',
          value: String(trigger.name || trigger['trigger-type']),
          type: 'text'
        });
      }
    } else if (backupActions.length > 0) {
      evidence.push({
        label: 'Status',
        value: '⚠️ Ação de backup existe, mas sem agendamento',
        type: 'text'
      });
    } else {
      evidence.push({
        label: 'Status',
        value: '❌ Nenhum backup automático configurado',
        type: 'text'
      });
    }
    
    // Mostrar totais encontrados
    evidence.push({
      label: 'Automações',
      value: `${stitches.length} stitches, ${triggers.length} triggers, ${actions.length} ações`,
      type: 'text'
    });
    
  } catch (e) {
    console.error('Error formatting Backup evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
  }
  
  return evidence;
}
```

#### Mudança 4: Atualizar mapeamento de endpoint para backup

Adicionar ao `sourceKeyToEndpoint` (linha 190+):

```typescript
'system_automation_stitch': '/api/v2/cmdb/system/automation-stitch',
'system_automation_trigger': '/api/v2/cmdb/system/automation-trigger',
'system_automation_action': '/api/v2/cmdb/system/automation-action',
```

#### Mudança 5: Corrigir nome do check de Backup

Como solicitado, trocar o nome exibido de "Backup Automático Configurado" para "Configuração de Backup Automático":

```sql
UPDATE compliance_rules 
SET name = 'Configuração de Backup Automático'
WHERE code = 'bkp-001';
```

---

## Resumo das Alterações

| Arquivo/Local | Alteração |
|---------------|-----------|
| `agent-task-result/index.ts` linha 699 | Trocar `backup-001` por `bkp-001` |
| `agent-task-result/index.ts` linhas 707-711 | Incluir rawData completo para lic-001, lic-002, bkp-001 |
| `agent-task-result/index.ts` linhas 568-591 | Reescrever `formatBackupEvidence` para usar dados de automação |
| `agent-task-result/index.ts` linha 190+ | Adicionar mappings de automation endpoints |
| Banco de dados | Atualizar nome da regra bkp-001 |

---

## Resultado Esperado

### FortiCare (lic-001)
- ✅ Endpoint consultado: `/api/v2/monitor/license/status`
- ✅ Evidências: Status, Data de Expiração, Dias Restantes
- ✅ **Dados brutos JSON** (antes faltava)

### Backup (bkp-001)
- ✅ **Endpoint consultado**: `/api/v2/cmdb/system/automation-stitch` (antes faltava)
- ✅ **Evidências organizadas**: Status, Ações, Agendamentos (antes faltava)
- ✅ Dados brutos JSON

### FortiGuard (lic-002)
- ✅ Sem alterações (já está perfeito)

---

## Validação

1. Executar nova análise do firewall
2. Verificar seção Licenciamento:
   - FortiCare: exibe endpoint, evidências E dados brutos JSON
   - FortiGuard: continua perfeito
3. Verificar seção Backup e Recovery:
   - Nome: "Configuração de Backup Automático"
   - Exibe endpoint consultado
   - Exibe evidências organizadas (Status, Ações, Agendamentos)
   - Exibe dados brutos JSON
