

## Trazer StorageQuota do SharePoint via Agent PowerShell

### Problema
A `collaboration-dashboard` edge function tenta obter a quota de storage do tenant via REST API do SPO Admin (`/_api/StorageQuota()`), mas essa API frequentemente falha (requer permissões específicas de admin). O comando PowerShell `Get-SPOTenant | Select StorageQuota` é confiável e retorna o valor em MB.

### Plano de implementação

#### 1. Adicionar módulo SharePoint Online ao Agent Python
**`python-agent/agent/executors/powershell.py`** — adicionar entrada no dict `MODULES`:

```python
"SharePointOnline": {
    "import": "Import-Module Microsoft.Online.SharePoint.PowerShell -ErrorAction Stop",
    "connect_cba": 'Connect-SPOService -Url "https://{spo_admin_url}" -Credential (New-Object System.Management.Automation.PSCredential("{app_id}", (New-Object System.Security.SecureString)))',
    "connect_credential": 'Connect-SPOService -Url "https://{spo_admin_url}" -Credential $cred',
    "disconnect": "Disconnect-SPOService -ErrorAction SilentlyContinue",
}
```

Nota: O `Connect-SPOService` com CBA usa `Connect-SPOService -Url ... -ClientId ... -Certificate...`. Precisa ser ajustado ao padrão de CBA real do módulo SPO. Alternativa mais segura: usar o módulo `PnP.PowerShell` que suporta CBA nativamente:

```python
"PnP.PowerShell": {
    "import": "Import-Module PnP.PowerShell -ErrorAction Stop",
    "connect_cba": 'Connect-PnPOnline -Url "https://{spo_admin_url}" -ClientId "{app_id}" -Thumbprint "{certificate_thumbprint}" -Tenant "{tenant_id}"',
    "disconnect": "Disconnect-PnPOnline -ErrorAction SilentlyContinue",
}
```

**Decisão necessária**: Qual módulo PowerShell usar para conectar ao SharePoint Online Admin com autenticação via certificado? As opções são:

- **Microsoft.Online.SharePoint.PowerShell** (SPO nativo) — requer `Connect-SPOService`
- **PnP.PowerShell** — suporta CBA com thumbprint nativamente

#### 2. Adicionar step ao blueprint hybrid (DB)
Inserir novo step `spo_tenant_quota` no blueprint `e276576e-0de0-4463-a0ee-940b970c4f69`:

```json
{
  "id": "spo_tenant_quota",
  "type": "powershell",
  "params": {
    "module": "SharePointOnline",
    "commands": [{
      "name": "spo_tenant_quota",
      "command": "Get-SPOTenant | Select-Object StorageQuota, StorageQuotaAllocated | ConvertTo-Json"
    }],
    "timeout": 60
  }
}
```

#### 3. Processar resultado no `collaboration-dashboard`
**`supabase/functions/collaboration-dashboard/index.ts`** — antes do fallback à REST API, consultar o último snapshot do analyzer para o dado do agent:

```typescript
// Try agent-collected SPO quota from latest analyzer snapshot
const { data: latestSnapshot } = await supabase
  .from('m365_analyzer_snapshots')
  .select('agent_task_id')
  .eq('tenant_record_id', tenant_record_id)
  .eq('status', 'completed')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (latestSnapshot?.agent_task_id) {
  const { data: stepResult } = await supabase
    .from('task_step_results')
    .select('data')
    .eq('task_id', latestSnapshot.agent_task_id)
    .eq('step_id', 'spo_tenant_quota')
    .maybeSingle();

  const quotaMB = stepResult?.data?.data?.[0]?.StorageQuota 
                || stepResult?.data?.StorageQuota || 0;
  if (quotaMB > 0) {
    storageAllocatedBytes = quotaMB * 1024 * 1024; // MB → bytes
  }
}
```

#### 4. Conversão de unidades
- Agent retorna `StorageQuota` em **MB** (ex: `1480192` MB ≈ 1445.5 GB ≈ 1.41 TB)
- Converter para bytes: `MB * 1024 * 1024`
- A UI já converte de GB para TB quando `>= 1024 GB` (lógica existente em `TeamsAnalyzerStatsCards`)

### Questão aberta
Preciso confirmar qual módulo PowerShell o agent já tem instalado no ambiente Linux para SharePoint Online admin (`Microsoft.Online.SharePoint.PowerShell` ou `PnP.PowerShell`), pois isso define o padrão de conexão CBA. Qual módulo está disponível no agent?

