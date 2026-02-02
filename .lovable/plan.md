
# Plano: Corrigir Verificação de Backup Automático em Firewalls Fortinet

## Problema Identificado

A lógica atual de verificação de backup em `fortigate-compliance/index.ts` está gerando **falsos positivos**. No firewall "BAU-FW":

1. **Existe** a action "Backup Config Disk" (action-type: system-actions, system-action: backup-config)
2. **Porém** essa action é apenas uma **template padrão do FortiOS** - não está associada a nenhum stitch/trigger
3. A análise incorretamente marca como "✅ Backup automático configurado"

### Dados Reais Coletados (BAU-FW)

**Stitches (9):** Nenhum relacionado a backup
```
- Compromised Host Quarantine (trigger: Compromised Host - High)
- Firmware upgrade notification (trigger: Auto Firmware upgrade)
- FortiAnalyzer Connection Down (trigger: FortiAnalyzer Connection Down)
- HA Failover (trigger: HA Failover)
- ... outros relacionados a eventos
```

**Actions (13):** Apenas templates padrão
```
- Backup Config Disk (action-type: system-actions, system-action: backup-config)
  → É uma action PADRÃO que faz backup local no disco
  → NÃO está associada a nenhum stitch com trigger agendado
  → NÃO exporta para área externa (FTP/SFTP/TFTP)
```

---

## Critérios Corretos para Backup Válido

Um backup automático é considerado **válido** apenas se:

1. **Existe um Stitch ativo** que amarra:
   - Um **Trigger agendado** (scheduled) 
   - Uma **Action de backup real** (cli-script com `execute backup`)

2. **O comando de backup exporta para área externa:**
   ```
   execute backup full-config ftp <server> <path> <user> <password>
   execute backup full-config sftp <server> <path> <user>
   execute backup full-config tftp <server> <path>
   execute backup config ftp|sftp|tftp ...
   ```

3. **Backup apenas local (disco)** deve gerar **warning**, não pass:
   - `system-action: backup-config` apenas salva no disco local
   - Não protege contra perda total do equipamento

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/fortigate-compliance/index.ts` | Refatorar `checkAutomatedBackup()` com lógica correta |

---

## Alterações Técnicas

### 1. Atualizar Interface `BackupConfig`

```typescript
interface BackupConfig {
  isConfigured: boolean;
  status: "active" | "inactive" | "local_only" | "not_configured";
  backupType: "external" | "local" | "none";  // NOVO
  destination?: string;  // NOVO: ftp/sftp/tftp + server
  frequency: string;
  detail: string;
  stitchName: string;
  triggerName: string;
  actionName: string;
}
```

### 2. Refatorar Lógica de Detecção

**Passo 1:** Verificar se existe Stitch ativo → Trigger agendado → Action

```typescript
// Para cada stitch ATIVO com trigger AGENDADO
for (const stitch of stitches) {
  if (stitch.status !== "enable") continue;
  
  // Verificar se o trigger é agendado
  const trigger = triggerMap.get(stitch.trigger);
  if (!isScheduledTrigger(trigger)) continue;
  
  // Verificar se alguma action é de backup
  for (const actionRef of stitch.actions) {
    const action = actionMap.get(actionRef.action);
    const backupInfo = analyzeBackupAction(action);
    
    if (backupInfo.isBackup) {
      // Backup encontrado!
    }
  }
}
```

**Passo 2:** Analisar tipo de backup na Action

```typescript
function analyzeBackupAction(action: any): {
  isBackup: boolean;
  type: "external" | "local" | "none";
  destination?: string;
} {
  const actionType = action["action-type"] || "";
  const script = action.script || "";
  const systemAction = action["system-action"] || "";
  
  // CLI-script com execute backup para área externa
  if (actionType === "cli-script") {
    const scriptLower = script.toLowerCase();
    
    // Backup para FTP
    if (scriptLower.includes("execute backup") && scriptLower.includes("ftp")) {
      const match = script.match(/execute backup (?:full-config|config) (ftp|sftp|tftp)\s+(\S+)/i);
      return {
        isBackup: true,
        type: "external",
        destination: match ? `${match[1]}://${match[2]}` : "FTP/SFTP/TFTP"
      };
    }
    
    // Backup local (apenas disco)
    if (scriptLower.includes("execute backup")) {
      return { isBackup: true, type: "local" };
    }
  }
  
  // system-action: backup-config (backup local no disco)
  if (systemAction === "backup-config") {
    return { isBackup: true, type: "local" };
  }
  
  return { isBackup: false, type: "none" };
}
```

**Passo 3:** Definir Status Baseado no Tipo

```typescript
// Backup para área externa = PASS
if (backupInfo.type === "external") {
  result.status = "active";
  result.backupType = "external";
  result.destination = backupInfo.destination;
}

// Backup apenas local = WARNING
else if (backupInfo.type === "local") {
  result.status = "local_only";
  result.backupType = "local";
}
```

### 3. Atualizar Evidências e Recomendações

```typescript
// Na função checkHAAndBackup():

let backupStatus: "pass" | "fail" | "warning" = "fail";
let backupDetails = "";
let backupRecommendation = "";

if (backupConfig.backupType === "external") {
  backupStatus = "pass";
  backupDetails = `Backup Externo Ativo | Destino: ${backupConfig.destination} | ${backupConfig.frequency}`;
  backupRecommendation = "Manter configuração atual";
}
else if (backupConfig.backupType === "local") {
  backupStatus = "warning";
  backupDetails = `Backup Local (disco) | ${backupConfig.frequency}`;
  backupRecommendation = "Configurar backup para servidor externo (FTP/SFTP) para proteção contra perda do equipamento";
}
else {
  // Verificar se existe action de backup órfã (não amarrada a stitch)
  const hasOrphanBackupAction = actions.some(a => 
    a.name?.toLowerCase().includes("backup") || 
    a["system-action"] === "backup-config"
  );
  
  if (hasOrphanBackupAction) {
    backupDetails = "Action de backup encontrada, mas não está associada a nenhum agendamento";
  } else {
    backupDetails = "Nenhum backup automático configurado";
  }
  backupRecommendation = "Criar automation stitch com trigger agendado + action cli-script com 'execute backup full-config ftp/sftp <server>'";
}
```

### 4. Atualizar Evidências Exibidas

```typescript
const backupEvidence: EvidenceItem[] = [];

if (backupConfig.backupType === "external") {
  backupEvidence.push(
    { label: "Status", value: "✅ Backup externo configurado", type: "text" },
    { label: "Destino", value: backupConfig.destination || "N/A", type: "code" },
    { label: "Frequência", value: backupConfig.frequency, type: "text" },
    { label: "Stitch", value: backupConfig.stitchName, type: "code" },
    { label: "Trigger", value: backupConfig.triggerName, type: "code" },
    { label: "Action", value: backupConfig.actionName, type: "code" }
  );
}
else if (backupConfig.backupType === "local") {
  backupEvidence.push(
    { label: "Status", value: "⚠️ Backup apenas local (disco)", type: "text" },
    { label: "Risco", value: "Não protege contra perda do equipamento", type: "text" },
    { label: "Frequência", value: backupConfig.frequency, type: "text" },
    { label: "Stitch", value: backupConfig.stitchName, type: "code" }
  );
}
else {
  backupEvidence.push(
    { label: "Status", value: "❌ Backup automático não configurado", type: "text" },
    { label: "Verificação", value: "Nenhum stitch de backup com trigger agendado encontrado", type: "text" }
  );
}
```

---

## Resultado Esperado

### Antes (incorreto):
```
Configuração de Backup Automático: ✅ PASS
Status: ✅ Backup automático configurado
Ação: Backup Config Disk
```

### Depois (correto - caso BAU-FW):
```
Configuração de Backup Automático: ❌ FAIL
Status: ❌ Backup automático não configurado
Verificação: Nenhum stitch de backup com trigger agendado encontrado
Recomendação: Criar automation stitch com trigger agendado + action cli-script com 'execute backup full-config ftp/sftp <server>'
```

### Caso com backup local:
```
Configuração de Backup Automático: ⚠️ WARNING
Status: ⚠️ Backup apenas local (disco)
Risco: Não protege contra perda do equipamento
Recomendação: Configurar backup para servidor externo (FTP/SFTP)
```

### Caso com backup externo correto:
```
Configuração de Backup Automático: ✅ PASS
Status: ✅ Backup externo configurado
Destino: sftp://192.168.1.100/backups
Frequência: daily at 02:00
Stitch: Backup-Diario
```
