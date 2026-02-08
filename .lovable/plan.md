
# Plano: Correção do Fluxo de Certificados para Exchange Online

## Diagnóstico Completo

Foram identificados **três problemas críticos** que impedem a autenticação do Exchange Online:

### Problema 1: Inconsistência no nome do arquivo de thumbprint

| Componente | Arquivo usado |
|------------|---------------|
| `check-deps.sh` (linha 330) | `/var/lib/iscope-agent/certs/m365.thumbprint` |
| `auth.py` (linha 10) | `/var/lib/iscope-agent/certs/thumbprint.txt` |
| `powershell.py` (linha 26) | `/var/lib/iscope-agent/certs/thumbprint.txt` |

**Resultado**: O Python nunca encontra o thumbprint porque o arquivo tem nome diferente.

### Problema 2: Formato inconsistente do thumbprint no banco

Alguns agents enviaram thumbprints com prefixo incorreto:

| Agent | Thumbprint no Banco |
|-------|---------------------|
| TASCHIBRA-IDA | `sha1 Fingerprint=47FF013BC99249965587DD92F7A7E9FAE7860331` |
| PRECISIO-AZ | `27FA1C0F9B0D62AF5781F3D2E8940832CFC21980` |

**Formato esperado pelo Azure**: Apenas o hash hexadecimal sem prefixos.

### Problema 3: State local impede reenvio do certificado

O Agent TASCHIBRA-IDA já tem `azure_certificate_key_id` no state local (gravado quando o certificado foi registrado no HOME tenant). Isso faz com que o método `_get_pending_certificate()` retorne `None`, impedindo o reenvio.

**Código relevante** (`heartbeat.py` linhas 21-23):
```python
# Certificate already registered in Azure
if self.state.data.get("azure_certificate_key_id"):
    return None  # <-- Para aqui e não envia o certificado
```

---

## Solução Proposta

### Parte 1: Corrigir nome do arquivo de thumbprint (check-deps.sh)

**Arquivo**: `python-agent/check-deps.sh`  
**Linha**: 330

**Alterar de**:
```bash
echo "$thumbprint" > "$CERT_DIR/m365.thumbprint"
```

**Para**:
```bash
echo "$thumbprint" > "$CERT_DIR/thumbprint.txt"
```

### Parte 2: Sanitizar thumbprint antes de enviar (Python Agent)

**Arquivo**: `python-agent/agent/auth.py`

Adicionar função para limpar o thumbprint:
```python
def get_certificate_thumbprint():
    """Read certificate thumbprint from file if available."""
    if THUMBPRINT_FILE.exists():
        raw = THUMBPRINT_FILE.read_text().strip()
        # Remove prefixos comuns do openssl (sha1 Fingerprint=, SHA1 Fingerprint=, etc)
        if '=' in raw:
            raw = raw.split('=', 1)[-1]
        # Remove dois pontos (AA:BB:CC -> AABBCC)
        return raw.replace(':', '').strip()
    return None
```

### Parte 3: Forçar reenvio de certificado para novos tenants

O problema é que o Agent já tem `azure_certificate_key_id` no state, então não tenta reenviar. Para suportar múltiplos tenants, precisamos de uma abordagem diferente.

**Opção escolhida**: Limpar o `azure_certificate_key_id` quando houver novos tenants que precisam do certificado.

**Arquivo**: `supabase/functions/agent-heartbeat/index.ts`

Na lógica de retorno do heartbeat, verificar se há tenants vinculados que ainda não têm certificado registrado:

```typescript
// Verificar se precisa forçar reenvio de certificado
let needsCertRefresh = false;
if (agent.azure_certificate_key_id) {
  // Verificar se há tenants vinculados sem certificado
  const { data: linkedTenantsNeedingCert } = await supabase
    .from('m365_tenant_agents')
    .select('tenant_record_id, m365_app_credentials!inner(certificate_thumbprint)')
    .eq('agent_id', agentId)
    .eq('enabled', true)
    .is('m365_app_credentials.certificate_thumbprint', null);
  
  if (linkedTenantsNeedingCert?.length > 0) {
    needsCertRefresh = true;
  }
}

// Se needsCertRefresh, retornar flag especial para agent limpar o state
```

**Porém**, isso requer mudança no Python Agent para interpretar a flag. Uma solução mais simples:

**Solução Simplificada**: Adicionar um campo no heartbeat response que informa se o certificado precisa ser reenviado:

```json
{
  "success": true,
  "request_certificate": true  // <-- Backend pede o certificado novamente
}
```

E o Python Agent, ao receber isso, inclui o certificado no próximo heartbeat mesmo se já tiver `azure_certificate_key_id`.

---

## Alterações Detalhadas

### 1. check-deps.sh (correção imediata)

| Linha | Antes | Depois |
|-------|-------|--------|
| 330 | `echo "$thumbprint" > "$CERT_DIR/m365.thumbprint"` | `echo "$thumbprint" > "$CERT_DIR/thumbprint.txt"` |

### 2. auth.py (sanitização do thumbprint)

Modificar a função `get_certificate_thumbprint()` para limpar o formato.

### 3. heartbeat.py (suporte a request_certificate)

Modificar `_get_pending_certificate()` para aceitar um parâmetro que força o envio:

```python
def _get_pending_certificate(self, force=False):
    if not CERT_FILE.exists():
        return None
    
    # Se não for forçado e já tiver registrado, não envia
    if not force and self.state.data.get("azure_certificate_key_id"):
        return None
    
    # ... resto do código
```

E no `send()`:

```python
# Check if backend requested certificate re-upload
request_cert = response.get("request_certificate", False)
if request_cert and not pending_cert:
    self.logger.info("Backend solicitou reenvio de certificado")
    # Force re-send on next heartbeat by clearing the flag
    if "azure_certificate_key_id" in self.state.data:
        del self.state.data["azure_certificate_key_id"]
        self.state.save()
```

### 4. agent-heartbeat Edge Function (solicitação de certificado)

Adicionar lógica para verificar se há tenants vinculados que precisam de certificado:

```typescript
// Check if agent has linked tenants needing certificate
let requestCertificate = false;
if (agent.certificate_thumbprint) {
  const { data: linkedTenants } = await supabase
    .from('m365_tenant_agents')
    .select(`
      tenant_record_id,
      m365_app_credentials!inner(certificate_thumbprint, app_object_id)
    `)
    .eq('agent_id', agentId)
    .eq('enabled', true);
  
  // Check if any linked tenant needs the certificate
  for (const link of linkedTenants || []) {
    const creds = link.m365_app_credentials;
    if (creds.app_object_id && creds.certificate_thumbprint !== agent.certificate_thumbprint) {
      requestCertificate = true;
      break;
    }
  }
}

// Include in response
return Response.json({
  success: true,
  // ... outros campos
  request_certificate: requestCertificate,
});
```

---

## Fluxo Corrigido

```text
1. Agent inicia
2. check-deps.sh gera certificado e salva em thumbprint.txt (corrigido)
3. Python lê thumbprint.txt e sanitiza o valor (corrigido)
4. Heartbeat:
   a. Se agent não tem azure_certificate_key_id → envia certificado
   b. Backend verifica se há tenants vinculados que precisam do cert
   c. Se sim, faz upload para o App Registration de cada tenant
   d. Retorna azure_certificate_key_id
5. Próximo Heartbeat:
   a. Agent já tem azure_certificate_key_id, não envia cert
   b. Backend verifica se há NOVOS tenants vinculados sem cert
   c. Se sim, retorna request_certificate: true
   d. Agent limpa azure_certificate_key_id e envia cert no próximo ciclo
```

---

## Ação Imediata para o Tenant BRASILUX

1. **Reconectar o tenant BRASILUX** via OAuth para capturar o `app_object_id`
2. **No servidor do Agent TASCHIBRA-IDA**:
   - Renomear o arquivo: `mv /var/lib/iscope-agent/certs/m365.thumbprint /var/lib/iscope-agent/certs/thumbprint.txt`
   - Limpar o state: editar `/var/lib/iscope/state.json` e remover a linha `azure_certificate_key_id`
   - Reiniciar o agent: `systemctl restart iscope-agent`
3. O certificado será reenviado e registrado

---

## Resumo de Alterações

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `python-agent/check-deps.sh` | EDIT | Corrigir nome do arquivo de thumbprint para `thumbprint.txt` |
| `python-agent/agent/auth.py` | EDIT | Sanitizar thumbprint (remover prefixo e dois pontos) |
| `python-agent/agent/heartbeat.py` | EDIT | Suporte a `request_certificate` do backend |
| `supabase/functions/agent-heartbeat/index.ts` | EDIT | Lógica para solicitar reenvio de certificado para novos tenants |
