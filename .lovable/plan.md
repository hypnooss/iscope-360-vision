

# Plano de Solução Completa: Certificado CBA no Tenant Cliente

## Problemas Identificados

### 1. CRÍTICO: Script `check-deps.sh` com CRLF (Line Endings Windows)
```
bash[15432]: /opt/iscope-agent/check-deps.sh: line 28: syntax error near unexpected token `$'{\r''
```
O arquivo foi salvo com line endings Windows (`\r\n`) em vez de Unix (`\n`). Isso quebra a execução do script.

**Solução**: Converter para LF e garantir que futuras edições mantenham formato Unix.

### 2. CRÍTICO: Falta arquivo `m365.pfx`
```bash
ls -la /var/lib/iscope-agent/certs/
m365.crt  ✓
m365.key  ✓
m365.pfx  ✗ FALTANDO!
```
O PowerShell requer arquivo PFX (PKCS#12), mas o PFX não foi gerado porque o script falhou com erro de CRLF.

**Solução**: Após corrigir CRLF, regenerar o PFX manualmente ou reiniciar o agent com flag.

### 3. CRÍTICO: Thumbprint com formato errado
```
sha1 Fingerprint=F5E4C5BDC18E0D1392EAF789B82973FB93BB3911
```
O arquivo `thumbprint.txt` contém o prefixo "sha1 Fingerprint=" mas o código espera apenas o thumbprint limpo. O código de sanitização existe mas o formato no arquivo foi gerado incorretamente.

**Solução**: O script `generate_certificate()` já deveria ter tratado isso, mas falhou devido ao CRLF.

### 4. CRÍTICO: Endpoint `addKey` requer `proof` JWT
O endpoint `POST /servicePrincipals/{id}/addKey` **exige** um parâmetro `proof` - um JWT assinado por um certificado **já registrado**.

Isso significa que é **IMPOSSÍVEL** adicionar o primeiro certificado via este endpoint!

**Solução**: Usar endpoint alternativo ou abordagem diferente:
- Opção A: `PATCH /applications/{id}` no App Registration (requer acesso ao tenant Home)
- Opção B: Upload via PowerShell com credenciais de admin (no próprio Agent)

### 5. State file em path diferente
```bash
cat /var/lib/iscope/state.json | jq .azure_certificate_key_id
cat: /var/lib/iscope/state.json: No such file or directory
```
O agent usa `/var/lib/iscope/state.json` mas os certs estão em `/var/lib/iscope-agent/certs/`. Pode haver inconsistência de paths ou o agent nunca registrou.

---

## Arquivos que Precisam de Alteração

### 1. `python-agent/check-deps.sh`
**Problema**: Line endings CRLF
**Solução**: Converter todas as linhas para LF (Unix format)

### 2. `supabase/functions/agent-heartbeat/index.ts`
**Problema**: Endpoint `addKey` requer `proof` JWT que não temos
**Solução**: Usar `PATCH /applications/{app_object_id}` no tenant Home

A estrutura do endpoint PATCH:
```typescript
// Buscar keyCredentials existentes
GET /applications/{appObjectId}?$select=keyCredentials

// Adicionar novo certificado à lista
PATCH /applications/{appObjectId}
{
  keyCredentials: [...existingKeys, newKey]
}
```

Isso requer:
1. `app_object_id` do `m365_global_config`
2. `home_tenant_id` do `m365_global_config`
3. Token obtido contra o tenant Home

### 3. `python-agent/agent/executors/powershell.py`
**Problema**: O parâmetro `organization` usa `tenant_id` como fallback, mas deveria usar o domínio `.onmicrosoft.com`

**Solução**: Garantir que o backend envie o `organization` correto no payload da task.

### 4. Database function `rpc_get_agent_tasks`
**Problema**: Não inclui o `tenant_domain` como `organization` no payload do step PowerShell

**Solução**: Modificar para incluir:
```sql
'organization', COALESCE(t.payload->>'organization', mt.tenant_domain, mt.tenant_id)
```

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ FLUXO CORRIGIDO DE UPLOAD DE CERTIFICADO                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Agent Linux                    Backend                     Azure           │
│  ┌─────────────┐               ┌─────────────┐            ┌─────────────┐   │
│  │ 1. Gera     │               │             │            │             │   │
│  │ certificado │               │             │            │             │   │
│  │ (check-deps)│               │             │            │             │   │
│  │             │               │             │            │             │   │
│  │ m365.crt    │               │             │            │             │   │
│  │ m365.key    │               │             │            │             │   │
│  │ m365.pfx ◄──│── PRECISA!    │             │            │             │   │
│  │ thumbprint  │               │             │            │             │   │
│  └─────────────┘               │             │            │             │   │
│        │                       │             │            │             │   │
│        │ 2. Heartbeat          │             │            │             │   │
│        │   + thumbprint        │             │            │             │   │
│        │   + public_key        │             │            │             │   │
│        └──────────────────────▶│             │            │             │   │
│                                │             │            │             │   │
│                                │ 3. Busca:   │            │             │   │
│                                │  - app_object_id         │             │   │
│                                │  - home_tenant_id        │             │   │
│                                │  - client_secret         │             │   │
│                                │             │            │             │   │
│                                │ 4. Token do │            │             │   │
│                                │ tenant HOME │───────────▶│ Tenant HOME │   │
│                                │             │◀───────────│ (MSP)       │   │
│                                │             │            │             │   │
│                                │ 5. GET      │───────────▶│             │   │
│                                │ /apps/{id}  │◀───────────│ keyCredentials │
│                                │             │            │             │   │
│                                │ 6. PATCH    │───────────▶│ App Reg +   │   │
│                                │ /apps/{id}  │            │ novo cert   │   │
│                                │             │◀───────────│             │   │
│                                │             │            │             │   │
│        ◀────── keyId ─────────│             │            │             │   │
│                                │             │            │             │   │
│  ┌─────────────┐               │             │            │             │   │
│  │ 7. PowerShell               │             │ ┌─────────────────────┐  │   │
│  │    Connect                  │             │ │ Tenant CLIENTE      │  │   │
│  │    -AppId                   │             │ │                     │  │   │
│  │    -CertificateFilePath     │─────────────│─│─▶ Service Principal │  │   │
│  │    -Organization ◄──────────│─ DOMÍNIO!   │ │   (herda cert do    │  │   │
│  │      "cliente.onmicrosoft.  │             │ │    App Registration)│  │   │
│  │       com"                  │             │ │                     │  │   │
│  └─────────────┘               │             │ └─────────────────────┘  │   │
│                                │             │                          │   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementação

### Passo 1: Corrigir `check-deps.sh` (CRLF → LF)

Reescrever o arquivo garantindo line endings Unix.

### Passo 2: Corrigir `agent-heartbeat/index.ts`

Substituir `uploadCertificateToServicePrincipal` por `uploadCertificateToAppRegistration`:

```typescript
async function uploadCertificateToAppRegistration(
  homeTenantId: string,
  appId: string,
  appObjectId: string,
  clientSecret: string,
  thumbprint: string,
  publicKey: string,
  agentId: string
): Promise<{ success: boolean; keyId?: string; error?: string }> {
  
  // 1. Obter token do tenant HOME (não do cliente!)
  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${homeTenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // 2. Buscar keyCredentials existentes
  const currentApp = await fetch(
    `https://graph.microsoft.com/v1.0/applications/${appObjectId}?$select=keyCredentials`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  const currentData = await currentApp.json();
  const existingKeys = currentData.keyCredentials || [];

  // 3. Preparar novo certificado
  const certBase64 = publicKey
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');

  const newKey = {
    type: 'AsymmetricX509Cert',
    usage: 'Verify',
    key: certBase64,
    displayName: `iScope-Agent-${agentId.substring(0, 8)}`,
  };

  // 4. PATCH com todos os certificados
  const patchResponse = await fetch(
    `https://graph.microsoft.com/v1.0/applications/${appObjectId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keyCredentials: [...existingKeys, newKey],
      }),
    }
  );

  if (!patchResponse.ok) {
    const errText = await patchResponse.text();
    return { success: false, error: `PATCH error: ${patchResponse.status} - ${errText}` };
  }

  return { success: true, keyId: thumbprint };
}
```

### Passo 3: Atualizar `uploadAgentCertificate` para usar Home Tenant

```typescript
async function uploadAgentCertificate(...) {
  // Usar home_tenant_id e app_object_id do global_config
  const { data: globalConfig } = await supabase
    .from('m365_global_config')
    .select('app_id, app_object_id, client_secret_encrypted, home_tenant_id')
    .single();

  return await uploadCertificateToAppRegistration(
    globalConfig.home_tenant_id,
    globalConfig.app_id,
    globalConfig.app_object_id,
    clientSecret,
    thumbprint,
    publicKey,
    agentId
  );
}
```

### Passo 4: Garantir `organization` correto nas tasks PowerShell

Modificar `rpc_get_agent_tasks` para usar `tenant_domain`:

```sql
'organization', COALESCE(t.payload->>'organization', mt.tenant_domain)
```

---

## Ação Manual Imediata no Agent

Enquanto eu implemento as correções, execute no agent:

```bash
# 1. Converter check-deps.sh para Unix line endings
sudo sed -i 's/\r$//' /opt/iscope-agent/check-deps.sh

# 2. Gerar PFX manualmente (se check-deps.sh não funcionar)
sudo openssl pkcs12 -export \
  -out /var/lib/iscope-agent/certs/m365.pfx \
  -inkey /var/lib/iscope-agent/certs/m365.key \
  -in /var/lib/iscope-agent/certs/m365.crt \
  -passout pass:

# 3. Corrigir thumbprint (remover prefixo)
sudo sh -c 'openssl x509 -in /var/lib/iscope-agent/certs/m365.crt -noout -fingerprint -sha1 | sed "s/.*=//" | tr -d ":" > /var/lib/iscope-agent/certs/thumbprint.txt'

# 4. Verificar
cat /var/lib/iscope-agent/certs/thumbprint.txt
# Deve mostrar apenas: F5E4C5BDC18E0D1392EAF789B82973FB93BB3911

# 5. Corrigir permissões
sudo chown iscope:iscope /var/lib/iscope-agent/certs/m365.pfx
sudo chmod 600 /var/lib/iscope-agent/certs/m365.pfx

# 6. Reiniciar agent
sudo systemctl restart iscope-agent
sudo journalctl -u iscope-agent -f
```

---

## Resumo de Alterações

| # | Arquivo | Alteração | Tipo |
|---|---------|-----------|------|
| 1 | `python-agent/check-deps.sh` | Converter CRLF → LF | Bug fix |
| 2 | `supabase/functions/agent-heartbeat/index.ts` | Mudar de `addKey` para `PATCH /applications` | Refactor |
| 3 | `supabase/migrations/` | Atualizar `rpc_get_agent_tasks` com `organization` | SQL |

