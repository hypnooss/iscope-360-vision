

# Plano: Corrigir Lógica de Re-upload de Certificado

## Problema Identificado

Existe uma lógica circular que impede o re-upload do certificado:

| Componente | Estado Atual | Comportamento |
|------------|--------------|---------------|
| **Banco (agents)** | `certificate_thumbprint = NULL` | Backend não envia `request_certificate` |
| **Agent state.json** | `azure_certificate_key_id = "..."` | Agent não envia certificado |

A condição atual no backend (linha 582):
```typescript
if (sanitizedAgentThumbprint && !sanitizedInputThumbprint)
```

Falha porque `sanitizedAgentThumbprint` é `NULL` após a remoção.

## Solução

### Cenário 1: Agent tem certificado local mas backend não tem registro

Quando:
- Backend não tem thumbprint no banco (`certificate_thumbprint = NULL`)
- Agent não está enviando thumbprint (porque pensa que já está registrado)
- Mas existem tenants vinculados que precisam do certificado

Backend deve enviar `request_certificate = true` para forçar re-envio.

### Cenário 2: Backend tem thumbprint mas agent não enviou

Este já está coberto pela lógica atual.

## Alterações Necessárias

### agent-heartbeat/index.ts

Modificar a lógica de verificação de tenants (linhas 580-607):

**Antes:**
```typescript
// Check if agent has linked tenants needing certificate registration
if (sanitizedAgentThumbprint && !sanitizedInputThumbprint) {
  // ... check tenants
}
```

**Depois:**
```typescript
// Check if agent has linked tenants needing certificate registration
// Case 1: Agent has thumbprint in DB but didn't send it (needs re-upload)
// Case 2: Agent's DB thumbprint was cleared but has linked tenants (needs full re-registration)
if (!sanitizedInputThumbprint) {
  try {
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
      const sanitizedCredThumbprint = sanitizeThumbprint(creds?.certificate_thumbprint);
      
      // Request certificate if:
      // 1. Tenant has app_object_id (can register certificates)
      // 2. AND either:
      //    a. Tenant doesn't have a certificate registered
      //    b. OR agent's DB thumbprint differs from tenant's
      if (creds?.app_object_id) {
        const needsCert = !sanitizedCredThumbprint || 
                          (sanitizedAgentThumbprint && sanitizedCredThumbprint !== sanitizedAgentThumbprint);
        if (needsCert) {
          requestCertificate = true;
          console.log(`Agent ${agentId}: tenant needs certificate (app_object_id: ${creds.app_object_id?.substring(0, 8)}..., cred: ${sanitizedCredThumbprint?.substring(0, 8) || 'null'}, agent_db: ${sanitizedAgentThumbprint?.substring(0, 8) || 'null'})`);
          break;
        }
      }
    }
  } catch (err) {
    console.error('Error checking linked tenants for certificate:', err);
  }
}
```

## Lógica Corrigida

```text
Heartbeat recebido (sem thumbprint no payload)
    ↓
Backend verifica: agent tem tenants vinculados?
    ↓
Para cada tenant com app_object_id:
    ↓
Tenant precisa de certificado?
  - Se tenant.certificate_thumbprint = NULL → SIM
  - Se tenant.certificate_thumbprint ≠ agent.certificate_thumbprint → SIM
    ↓
Se SIM → request_certificate = true
    ↓
Agent recebe request_certificate = true
    ↓
Agent limpa azure_certificate_key_id do state local
    ↓
Próximo heartbeat: Agent envia certificado
    ↓
Backend faz upload para Azure
```

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-heartbeat/index.ts` | Corrigir condição de verificação de certificado pendente |

## Teste Esperado

Após a correção:
1. Agent faz heartbeat (sem enviar certificado)
2. Backend vê: tenant BRASILUX tem `app_object_id` mas `certificate_thumbprint = NULL`
3. Backend retorna: `request_certificate: true`
4. Log do agent: "Backend solicitou reenvio de certificado"
5. Agent limpa `azure_certificate_key_id` do state
6. Próximo heartbeat: Agent envia certificado
7. Backend registra no Azure e salva thumbprint

