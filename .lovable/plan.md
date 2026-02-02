
# Plano: Corrigir Lógica de Backup em agent-task-result

## Problema Raiz Identificado

A Edge Function `agent-task-result/index.ts` possui sua própria função `formatBackupEvidence()` (linhas 1048-1134) que usa lógica **incorreta e diferente** da que foi corrigida em `fortigate-compliance/index.ts`.

A lógica atual em `agent-task-result` está errada porque:

```typescript
// Linha 1063-1067: Pega QUALQUER action com nome "backup"
const backupActions = actions.filter(a => 
  a['action-type'] === 'backup' || 
  a['action-type'] === 'config-backup' ||
  String(a.name || '').toLowerCase().includes('backup')  // ← PEGA "Backup Config Disk" padrão!
);

// Linha 1071-1074: Pega QUALQUER trigger agendado (não precisa estar relacionado ao backup)
const scheduledTriggers = triggers.filter(t => 
  t['trigger-type'] === 'scheduled' || 
  t['trigger-type'] === 'event-based'  // ← ERRADO: inclui triggers de evento!
);

// Linha 1079: Se ambos existem → backup configurado
// ← ERRADO: não verifica se estão AMARRADOS por um Stitch!
if (backupActions.length > 0 && scheduledTriggers.length > 0) {
  isConfigured = true;  // FALSO POSITIVO!
}
```

No caso do BAU-FW:
- **Existe** a action "Backup Config Disk" (padrão do FortiOS)
- **Existem** triggers agendados (mas para firmware upgrade, HA failover, etc.)
- **NÃO existe** um Stitch que amarra um trigger agendado a uma action de backup

---

## Solução

Refatorar `formatBackupEvidence()` em `agent-task-result/index.ts` com a mesma lógica correta de `fortigate-compliance/index.ts`:

1. **Verificar Stitch ativo** → conecta trigger + action
2. **Verificar Trigger agendado** (scheduled, não event-based)
3. **Analisar Action de backup**:
   - CLI-script com `execute backup [full-config|config] [ftp|sftp|tftp]` → **Externo (Pass)**
   - CLI-script com `execute backup` sem destino externo → **Local (Warning)**
   - `system-action: backup-config` sem Stitch → **Não configurado (Fail)**
4. **Sem Stitch válido** = backup não configurado

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-task-result/index.ts` | Refatorar `formatBackupEvidence()` (linhas 1048-1134) |

---

## Alterações Detalhadas

### 1. Adicionar Funções Auxiliares (antes da linha 1048)

```typescript
// Analisa se uma action é de backup e qual o tipo (externo/local)
function analyzeBackupActionForEvidence(action: Record<string, unknown>): {
  isBackup: boolean;
  type: "external" | "local" | "none";
  destination?: string;
} {
  if (!action) return { isBackup: false, type: "none" };
  
  const actionType = String(action["action-type"] || action.type || "");
  const script = String(action.script || action.command || "");
  const systemAction = String(action["system-action"] || "");
  
  // CLI-script com execute backup
  if (actionType === "cli-script" || script) {
    const scriptLower = script.toLowerCase();
    
    // Backup para área externa (FTP/SFTP/TFTP)
    if (scriptLower.includes("execute backup") && 
        (scriptLower.includes("ftp") || scriptLower.includes("sftp") || scriptLower.includes("tftp"))) {
      const match = script.match(/execute backup (?:full-config|config)\s+(ftp|sftp|tftp)\s+["']?(\S+)["']?/i);
      const destination = match ? `${match[1]}://${match[2]}` : "FTP/SFTP/TFTP";
      return { isBackup: true, type: "external", destination };
    }
    
    // Backup local (apenas disco)
    if (scriptLower.includes("execute backup")) {
      return { isBackup: true, type: "local" };
    }
  }
  
  // system-action: backup-config (backup local no disco - padrão FortiOS)
  // IMPORTANTE: Só conta se estiver dentro de um Stitch ativo!
  if (systemAction === "backup-config") {
    return { isBackup: true, type: "local" };
  }
  
  return { isBackup: false, type: "none" };
}

// Verifica se um trigger é do tipo agendado
function isScheduledTriggerForEvidence(trigger: Record<string, unknown>): boolean {
  if (!trigger) return false;
  const triggerType = String(trigger["trigger-type"] || trigger.type || "");
  // IMPORTANTE: event-based NÃO é agendado!
  return triggerType === "scheduled" || triggerType === "schedule";
}

// Extrai frequência de um trigger
function extractTriggerFrequencyForEvidence(trigger: Record<string, unknown>): string {
  const frequency = String(trigger["trigger-frequency"] || trigger.frequency || "daily");
  const hour = Number(trigger["trigger-hour"] ?? trigger.hour ?? 0);
  const minute = Number(trigger["trigger-minute"] ?? trigger.minute ?? 0);
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return `${frequency} às ${timeStr}`;
}
```

### 2. Refatorar formatBackupEvidence (substituir linhas 1048-1134)

```typescript
function formatBackupEvidence(rawData: Record<string, unknown>): { 
  evidence: EvidenceItem[], 
  isConfigured: boolean,
  backupType: "external" | "local" | "none"
} {
  const evidence: EvidenceItem[] = [];
  let isConfigured = false;
  let backupType: "external" | "local" | "none" = "none";
  
  try {
    const stitchData = rawData['system_automation_stitch'] as Record<string, unknown> | undefined;
    const triggerData = rawData['system_automation_trigger'] as Record<string, unknown> | undefined;
    const actionData = rawData['system_automation_action'] as Record<string, unknown> | undefined;
    
    const stitches = (stitchData?.results || []) as Array<Record<string, unknown>>;
    const triggers = (triggerData?.results || []) as Array<Record<string, unknown>>;
    const actions = (actionData?.results || []) as Array<Record<string, unknown>>;
    
    console.log(`[BKP] Processing ${stitches.length} stitches, ${triggers.length} triggers, ${actions.length} actions`);
    
    // Mapear triggers e actions por nome
    const triggerMap = new Map<string, Record<string, unknown>>();
    for (const t of triggers) triggerMap.set(String(t.name), t);
    
    const actionMap = new Map<string, Record<string, unknown>>();
    for (const a of actions) actionMap.set(String(a.name), a);
    
    // Variáveis para melhor backup encontrado
    let bestBackup: {
      type: "external" | "local";
      destination?: string;
      frequency: string;
      stitchName: string;
      triggerName: string;
      actionName: string;
    } | null = null;
    
    // PASSO 1: Procurar backup VÁLIDO através de Stitches ATIVOS + Trigger AGENDADO
    for (const stitch of stitches) {
      // Verificar se stitch está ativo
      if (stitch.status && stitch.status !== "enable") continue;
      
      // Extrair trigger(s) do stitch
      let triggerRefs = stitch.trigger || stitch.triggers || [];
      if (!Array.isArray(triggerRefs)) triggerRefs = [triggerRefs];
      
      // Extrair action(s) do stitch
      let actionRefs = stitch.actions || stitch.action || [];
      if (!Array.isArray(actionRefs)) actionRefs = [actionRefs];
      
      for (const triggerRef of triggerRefs) {
        const triggerName = typeof triggerRef === "string" ? triggerRef : String(triggerRef?.name || "");
        if (!triggerName) continue;
        
        const trigger = triggerMap.get(triggerName);
        if (!trigger) continue;
        
        // CRITÉRIO: Trigger deve ser AGENDADO (não event-based)
        if (!isScheduledTriggerForEvidence(trigger)) {
          console.log(`[BKP] Stitch ${stitch.name}: Trigger ${triggerName} não é agendado`);
          continue;
        }
        
        for (const actionRef of actionRefs) {
          let actionName = "";
          if (typeof actionRef === "string") actionName = actionRef;
          else if (actionRef?.action) actionName = String(actionRef.action);
          else if (actionRef?.name) actionName = String(actionRef.name);
          if (!actionName) continue;
          
          const action = actionMap.get(actionName);
          const backupInfo = analyzeBackupActionForEvidence(action || { name: actionName });
          
          if (!backupInfo.isBackup) continue;
          
          // BACKUP ENCONTRADO!
          const frequency = extractTriggerFrequencyForEvidence(trigger);
          
          const candidate = {
            type: backupInfo.type as "external" | "local",
            destination: backupInfo.destination,
            frequency,
            stitchName: String(stitch.name),
            triggerName,
            actionName
          };
          
          // Priorizar externo sobre local
          if (backupInfo.type === "external") {
            bestBackup = candidate;
            console.log(`[BKP] ✅ Backup EXTERNO: ${stitch.name} -> ${backupInfo.destination}`);
            break; // Encontrou externo, parar
          } else if (!bestBackup) {
            bestBackup = candidate;
            console.log(`[BKP] ⚠️ Backup LOCAL: ${stitch.name}`);
          }
        }
        if (bestBackup?.type === "external") break;
      }
      if (bestBackup?.type === "external") break;
    }
    
    // Gerar evidências com base no resultado
    if (bestBackup) {
      isConfigured = bestBackup.type === "external";
      backupType = bestBackup.type;
      
      if (bestBackup.type === "external") {
        evidence.push({ label: 'Status', value: '✅ Backup externo configurado', type: 'text' });
        if (bestBackup.destination) {
          evidence.push({ label: 'Destino', value: bestBackup.destination, type: 'code' });
        }
      } else {
        evidence.push({ label: 'Status', value: '⚠️ Backup apenas local (disco)', type: 'text' });
        evidence.push({ label: 'Risco', value: 'Não protege contra perda do equipamento', type: 'text' });
      }
      
      evidence.push({ label: 'Frequência', value: bestBackup.frequency, type: 'text' });
      evidence.push({ label: 'Stitch', value: bestBackup.stitchName, type: 'code' });
      evidence.push({ label: 'Trigger', value: bestBackup.triggerName, type: 'code' });
      evidence.push({ label: 'Action', value: bestBackup.actionName, type: 'code' });
    } else {
      // Verificar se existem actions de backup órfãs (não amarradas a stitch agendado)
      const orphanBackupActions = actions.filter(a => {
        const info = analyzeBackupActionForEvidence(a);
        return info.isBackup;
      });
      
      if (orphanBackupActions.length > 0) {
        evidence.push({ 
          label: 'Status', 
          value: '❌ Actions de backup encontradas, mas sem agendamento ativo', 
          type: 'text' 
        });
        evidence.push({ 
          label: 'Verificação', 
          value: 'Nenhum Stitch ativo conecta um Trigger agendado a uma Action de backup', 
          type: 'text' 
        });
      } else {
        evidence.push({ label: 'Status', value: '❌ Backup automático não configurado', type: 'text' });
      }
      
      evidence.push({ 
        label: 'Recomendação', 
        value: 'Criar automation stitch com trigger agendado + action cli-script: execute backup full-config ftp/sftp <server>', 
        type: 'text' 
      });
    }
    
    // Totais para debug
    evidence.push({
      label: 'Automações',
      value: `${stitches.length} stitches, ${triggers.length} triggers, ${actions.length} ações`,
      type: 'text'
    });
    
  } catch (e) {
    console.error('[BKP] Error formatting Backup evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
  }
  
  return { evidence, isConfigured, backupType };
}
```

### 3. Atualizar Chamada da Função (linha ~2655)

A chamada existente em `evaluateRule()` precisa considerar o novo campo `backupType`:

```typescript
} else if (rule.code === 'bkp-001') {
  const backupResult = formatBackupEvidence(rawData);
  evidence = backupResult.evidence;
  
  // Determinar status baseado no tipo de backup
  if (backupResult.backupType === 'external') {
    status = 'pass';
    details = rule.pass_description || 'Backup automático externo configurado';
  } else if (backupResult.backupType === 'local') {
    status = 'warn';
    details = 'Backup apenas local configurado - não protege contra perda do equipamento';
  } else {
    status = 'fail';
    details = rule.fail_description || 'Nenhum backup automático configurado';
  }
}
```

---

## Resultado Esperado

### BAU-FW (sem backup configurado):
```
Configuração de Backup Automático: ❌ FAIL
Status: ❌ Actions de backup encontradas, mas sem agendamento ativo
Verificação: Nenhum Stitch ativo conecta um Trigger agendado a uma Action de backup
Recomendação: Criar automation stitch com trigger agendado...
Automações: 9 stitches, 10 triggers, 13 ações
```

### Firewall com backup externo:
```
Configuração de Backup Automático: ✅ PASS
Status: ✅ Backup externo configurado
Destino: sftp://192.168.1.100/backups
Frequência: daily às 02:00
Stitch: Backup-Diario
```

### Firewall com backup local:
```
Configuração de Backup Automático: ⚠️ WARNING
Status: ⚠️ Backup apenas local (disco)
Risco: Não protege contra perda do equipamento
Frequência: daily às 02:00
```
