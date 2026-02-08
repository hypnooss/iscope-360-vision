

# Plano: Correções Finais para Upload de Certificado

## Diagnóstico Atual

| Item | Estado Atual | Estado Esperado |
|------|--------------|-----------------|
| `app_object_id` (BRASILUX) | `NULL` | UUID do App Registration |
| `certificate_thumbprint` (agents) | `sha1 Fingerprint=47FF...` | `47FF...` |
| `certificate_thumbprint` (credentials) | `NULL` | `47FF...` (após upload) |
| `request_certificate` | Não funciona | Deveria pedir certificado |

## Problemas Identificados

### Problema 1: app_object_id não foi capturado
O OAuth do tenant BRASILUX foi realizado **antes** da implementação que busca o App Registration Object ID. Sem esse ID, o backend não consegue fazer `PATCH /applications/{id}` para registrar o certificado.

**Solução**: Reconectar o tenant BRASILUX via OAuth.

### Problema 2: Thumbprint sujo no banco de dados
O thumbprint salvo na tabela `agents` contém o prefixo `sha1 Fingerprint=` do OpenSSL. A sanitização foi implementada no Python Agent, mas o valor já estava no banco.

**Solução**: Adicionar sanitização no backend (agent-heartbeat) ao receber e ao comparar thumbprints.

### Problema 3: Lógica de request_certificate não aciona
A lógica atual (linha 575) compara:
```typescript
creds?.certificate_thumbprint !== agentData.certificate_thumbprint
```

Mas `app_object_id` é `NULL`, então a condição anterior (`creds?.app_object_id`) falha e o bloco não executa.

**Solução**: Após reconectar o OAuth, o fluxo funcionará automaticamente.

## Alterações Necessárias

### 1. Sanitização de Thumbprint no Backend

**Arquivo**: `supabase/functions/agent-heartbeat/index.ts`

Adicionar função helper para sanitizar thumbprint:

```typescript
function sanitizeThumbprint(thumbprint: string | null | undefined): string | null {
  if (!thumbprint) return null;
  let clean = thumbprint.trim();
  // Remove OpenSSL prefixes like "sha1 Fingerprint=", "SHA1 Fingerprint=", etc.
  if (clean.includes('=')) {
    clean = clean.split('=').pop() || clean;
  }
  // Remove colons (AA:BB:CC -> AABBCC)
  clean = clean.replace(/:/g, '');
  return clean.toUpperCase().trim();
}
```

Usar essa função:
- Ao receber `body.certificate_thumbprint`
- Ao comparar com `agentData.certificate_thumbprint`
- Ao comparar com `creds?.certificate_thumbprint`

### 2. Atualizar Thumbprint no banco ao processar

Quando o certificado é processado com sucesso, atualizar o thumbprint sanitizado no banco:

```typescript
// Ao salvar o certificado no agents
await supabase
  .from('agents')
  .update({ 
    certificate_thumbprint: sanitizedThumbprint,  // Sanitizado
    // ... outros campos
  })
  .eq('id', agentId);
```

## Fluxo Corrigido

```text
1. Admin reconecta BRASILUX via OAuth
   ↓
2. OAuth callback busca app_object_id via GET /applications(appId='...')
   ↓
3. Salva app_object_id em m365_app_credentials
   ↓
4. Próximo heartbeat do agent TASCHIBRA-IDA:
   - Backend vê: app_object_id existe, certificate_thumbprint = NULL
   - Backend retorna: request_certificate = true
   ↓
5. Agent limpa azure_certificate_key_id do state local
   ↓
6. Próximo heartbeat do agent:
   - Agent envia certificate_thumbprint + certificate_public_key
   - Backend sanitiza thumbprint
   - Backend faz upload para App Registration do cliente via PATCH /applications/{app_object_id}
   - Backend salva thumbprint em m365_app_credentials.certificate_thumbprint
   ↓
7. PowerShell consegue conectar ao Exchange Online
```

## Ações Imediatas

### Para o Admin

1. **Reconectar o tenant BRASILUX via OAuth**
   - Acesse a página do tenant M365
   - Clique em "Reconectar" ou "Validar Conexão"
   - Complete o fluxo OAuth com Admin Consent
   - Isso irá capturar o `app_object_id`

### Alterações de Código

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-heartbeat/index.ts` | Adicionar `sanitizeThumbprint()` e usar em todas comparações |

## Código da Correção

### agent-heartbeat/index.ts

```typescript
// Adicionar no início do arquivo (após imports)
function sanitizeThumbprint(thumbprint: string | null | undefined): string | null {
  if (!thumbprint) return null;
  let clean = thumbprint.trim();
  // Remove OpenSSL prefixes like "sha1 Fingerprint=", "SHA1 Fingerprint=", etc.
  if (clean.includes('=')) {
    clean = clean.split('=').pop() || clean;
  }
  // Remove colons (AA:BB:CC -> AABBCC)
  clean = clean.replace(/:/g, '');
  return clean.toUpperCase().trim();
}

// Na função principal, ao processar certificado:
const sanitizedInputThumbprint = sanitizeThumbprint(body.certificate_thumbprint);
const sanitizedAgentThumbprint = sanitizeThumbprint(agentData?.certificate_thumbprint);

// Usar esses valores sanitizados em todas as comparações
```

### Correção adicional na função uploadAgentCertificate

Garantir que o thumbprint sanitizado seja passado para a função de upload:

```typescript
azureCertificateKeyId = await uploadAgentCertificate(
  supabase,
  agentId,
  sanitizedInputThumbprint, // Usar versão sanitizada
  body.certificate_public_key
);
```

E dentro da função, ao salvar no banco:
```typescript
await supabase
  .from('agents')
  .update({
    certificate_thumbprint: sanitizedThumbprint,  // Sempre sanitizado
    azure_certificate_key_id: keyId,
  })
  .eq('id', agentId);
```

