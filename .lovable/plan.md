

# Plano: Corrigir Decriptação na Validação Automatizada de Permissões M365

## Diagnóstico

A mensagem de erro "Falha na Conexão M365 - Não foi possível conectar à API Microsoft Graph para validar permissões" é causada por uma inconsistência no código de decriptação do Client Secret.

| Função | Método de Decriptação | Suporta AES-GCM? |
|--------|----------------------|------------------|
| `get-m365-config` | AES-256-GCM | Sim |
| `m365-oauth-callback` | AES-256-GCM | Sim |
| `validate-m365-permissions` | Base64 simples | Não |

A edge function `validate-m365-permissions` usa `atob()` (Base64) enquanto as outras funções usam AES-256-GCM. Como seu Client Secret está armazenado com AES-GCM, a função não consegue decriptá-lo corretamente e falha ao tentar obter um token de acesso (401).

---

## Solução

Atualizar a função `validate-m365-permissions/index.ts` para usar o mesmo padrão de decriptação AES-256-GCM das demais funções.

### Arquivo a Modificar

**`supabase/functions/validate-m365-permissions/index.ts`**

### Alterações Necessárias

#### 1. Substituir a função `decryptSecret` (linhas 29-35)

Trocar a implementação Base64 simples pela versão AES-GCM completa:

```typescript
// ============= AES-256-GCM Decryption =============

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get('M365_ENCRYPTION_KEY');
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('M365_ENCRYPTION_KEY not configured or invalid');
  }
  
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(keyHex.substr(i * 2, 2), 16);
  }
  
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

function fromHex(hex: string): Uint8Array {
  const length = hex.length / 2;
  const buffer = new ArrayBuffer(length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function decryptSecret(encrypted: string): Promise<string> {
  // AES-GCM format: iv:ciphertext (hex encoded)
  if (encrypted.includes(':')) {
    try {
      const [ivHex, ctHex] = encrypted.split(':');
      const key = await getEncryptionKey();
      const iv = fromHex(ivHex);
      const ciphertext = fromHex(ctHex);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('AES-GCM decryption failed:', error);
      return '';
    }
  }
  
  // Legacy Base64 fallback
  try {
    console.warn('Using legacy Base64 decryption');
    return atob(encrypted);
  } catch {
    return '';
  }
}
```

#### 2. Atualizar chamada na linha 245

A chamada precisa usar `await` pois agora a função é assíncrona:

```typescript
// De:
const clientSecret = decryptSecret(configData.client_secret_encrypted);

// Para:
const clientSecret = await decryptSecret(configData.client_secret_encrypted);
```

---

## Verificação do Secret M365_ENCRYPTION_KEY

A edge function precisa ter acesso ao secret `M365_ENCRYPTION_KEY` (64 caracteres hexadecimais) que é usado para decriptação. Este secret já deve estar configurado pois as outras funções funcionam corretamente.

---

## Resultado Esperado

Após a correção:

1. A validação automática de permissões funcionará corretamente
2. O alerta "Falha na Conexão M365" será automaticamente desativado após uma validação bem-sucedida
3. Consistência entre todas as edge functions que acessam credenciais M365

---

## Resumo das Mudanças

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/validate-m365-permissions/index.ts` | Adicionar funções AES-GCM e atualizar `decryptSecret` |

