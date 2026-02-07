

# Plano: Corrigir DecryptSecret no Agent-Heartbeat

## Problema Identificado

O edge function `agent-heartbeat` usa uma versão **obsoleta** da função `decryptSecret`:

```typescript
// Versão atual (ERRADA) - só suporta XOR/base64
const decryptSecret = (encrypted: string): string => {
  const data = atob(encrypted);  // FALHA: formato é "iv:ciphertext" hex
  ...
}
```

O segredo está armazenado no formato **AES-256-GCM** (`iv:ciphertext` em hexadecimal), mas a função espera **base64**.

**Erro nos logs:**
```
InvalidCharacterError: Failed to decode base64
    at atob (ext:deno_web/05_base64.js:28:12)
    at decryptSecret
```

## Fluxo do Problema

```text
1. Agent envia heartbeat com certificado
2. agent-heartbeat tenta fazer upload para Azure
3. Busca client_secret_encrypted da m365_global_config
4. Chama decryptSecret() com "iv:ciphertext"
5. decryptSecret() tenta atob() em string hex
6. ERRO: "Failed to decode base64"
7. Upload falha, certificado não é salvo
```

---

## Solução

Atualizar a função `decryptSecret` no `agent-heartbeat` para usar a mesma implementação das outras edge functions que suporta **AES-256-GCM**.

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-heartbeat/index.ts` | Substituir `decryptSecret` pela versão AES-GCM |

---

## Código Atualizado

Substituir as linhas 122-130 (função inline) por uma função completa:

```typescript
// Decrypt secret using AES-256-GCM
// Supports legacy XOR format for backwards compatibility
async function decryptSecret(encrypted: string): Promise<string> {
  const encryptionKey = Deno.env.get('M365_ENCRYPTION_KEY');
  if (!encryptionKey) {
    throw new Error('M365_ENCRYPTION_KEY not configured');
  }

  // AES-GCM format: iv:ciphertext (hex encoded)
  if (encrypted.includes(':')) {
    try {
      const [ivHex, ciphertextHex] = encrypted.split(':');
      const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      const ciphertext = new Uint8Array(ciphertextHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      
      // Derive 256-bit key from encryption key using SHA-256
      const keyMaterial = new TextEncoder().encode(encryptionKey);
      const keyHash = await crypto.subtle.digest('SHA-256', keyMaterial);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyHash,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        ciphertext
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('AES-GCM decryption failed:', error);
      throw new Error('Failed to decrypt secret (AES-GCM)');
    }
  }

  // Legacy XOR format (base64 encoded)
  try {
    const data = atob(encrypted);
    let result = '';
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(
        data.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length)
      );
    }
    return result;
  } catch (error) {
    console.error('Legacy decryption failed:', error);
    throw new Error('Failed to decrypt secret (legacy)');
  }
}
```

---

## Ajustar a Função uploadAgentCertificate

A função `uploadAgentCertificate` também precisa ser ajustada para usar a versão assíncrona:

**Antes:**
```typescript
const clientSecret = decryptSecret(globalConfig.client_secret_encrypted);
```

**Depois:**
```typescript
const clientSecret = await decryptSecret(globalConfig.client_secret_encrypted);
```

E remover a função inline `decryptSecret` que está dentro de `uploadAgentCertificate`.

---

## Resultado Esperado

Após a correção:

1. Agent envia heartbeat com certificado
2. `decryptSecret()` detecta formato AES-GCM (contém `:`)
3. Decripta usando AES-256-GCM
4. Obtém access token do Azure
5. Upload do certificado para o App Registration
6. Salva no banco: `certificate_thumbprint`, `certificate_public_key`, `azure_certificate_key_id`
7. Retorna `azure_certificate_key_id` para o agent

---

## Verificação

Após deploy, verificar:

1. Logs do edge function não mostram mais erros de base64
2. Query no banco mostra certificado registrado:
   ```sql
   SELECT certificate_thumbprint, azure_certificate_key_id 
   FROM agents WHERE name = 'PRECISIO-AZ'
   ```
3. No Azure Portal: App Registration mostra nova chave de certificado

