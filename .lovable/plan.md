

# Plano: Corrigir Derivação da Chave AES no Agent-Heartbeat

## Resumo

A função `decryptSecret` no `agent-heartbeat` está tratando a chave `M365_ENCRYPTION_KEY` de forma incorreta, causando falha na descriptografia do `client_secret` necessário para autenticar com o Azure e fazer upload do certificado.

---

## Problema Identificado

### Comparação das implementações

| Edge Function | Código | Resultado |
|--------------|--------|-----------|
| `entra-id-security-insights` | `fromHex(keyHex)` - converte hex direto para bytes | **FUNCIONA** |
| `agent-heartbeat` | `TextEncoder.encode()` + SHA-256 hash | **FALHA** |

### Código Atual (ERRADO)

```typescript
// Linhas 59-61 do agent-heartbeat
const keyMaterial = new TextEncoder().encode(encryptionKey);  // Trata hex como texto UTF-8
const keyHash = await crypto.subtle.digest('SHA-256', keyMaterial);  // Hash desnecessário
```

### Código Correto (entra-id-security-insights)

```typescript
// A chave M365_ENCRYPTION_KEY já é hex de 64 chars (32 bytes)
const keyBytes = fromHex(keyHex);  // Converte direto para bytes
```

A `M365_ENCRYPTION_KEY` é uma string hexadecimal de 64 caracteres que representa 32 bytes. Deve ser convertida diretamente para bytes, não tratada como texto UTF-8.

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-heartbeat/index.ts` | Alinhar implementação com outras edge functions M365 |

---

## Mudanças Necessárias

### 1. Adicionar função `fromHex` (nova)

```typescript
function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}
```

### 2. Adicionar função `getEncryptionKey` (nova)

```typescript
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get('M365_ENCRYPTION_KEY');
  if (!keyHex) {
    throw new Error('M365_ENCRYPTION_KEY not configured');
  }
  
  const keyBytes = fromHex(keyHex);
  return await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}
```

### 3. Reescrever função `decryptSecret`

```typescript
async function decryptSecret(encrypted: string): Promise<string> {
  // Legacy format (no colon) - try base64
  if (!encrypted.includes(':')) {
    try {
      return atob(encrypted);
    } catch {
      return encrypted;
    }
  }
  
  // AES-GCM format: iv:ciphertext (hex encoded)
  try {
    const [ivHex, ciphertextHex] = encrypted.split(':');
    const iv = fromHex(ivHex);
    const ciphertext = fromHex(ciphertextHex);
    const key = await getEncryptionKey();
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('AES-GCM decryption failed:', error);
    throw new Error('Failed to decrypt secret');
  }
}
```

---

## Impacto

- **Agent**: Não precisa de atualização (continua v1.2.3)
- **Edge Function**: Apenas `agent-heartbeat` será atualizado
- **Deploy**: Automático após aprovação

---

## Resultado Esperado

Após deploy, o próximo heartbeat do agent (em até 60 segundos) deve:

1. Enviar certificado pendente
2. Edge function descriptografar `client_secret` com sucesso
3. Autenticar com Azure AD
4. Fazer upload do certificado para o App Registration
5. Salvar `azure_certificate_key_id` no banco
6. Retornar confirmação para o agent

---

## Verificação

1. **Logs do Agent** - não deve mais mostrar "Certificado pendente"
2. **Banco de dados:**
   ```sql
   SELECT name, certificate_thumbprint, azure_certificate_key_id 
   FROM agents WHERE name = 'PRECISIO-AZ'
   ```
3. **Azure Portal** - App Registration deve mostrar nova chave de certificado
4. **Nova página de detalhes do Agent** - deve exibir o certificado registrado

