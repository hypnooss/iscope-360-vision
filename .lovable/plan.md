
# Plano: Corrigir Upload de Certificado para Azure

## Problemas Identificados

### Problema 1: Regex Incorreto (Bug Crítico)
O código tem um escape duplo no regex que impede a remoção de whitespace do certificado:

```typescript
// ERRADO (linha 208)
.replace(/\\s+/g, '')  // Procura literal "\s+", não whitespace

// CORRETO
.replace(/\s+/g, '')   // Remove espaços, tabs, quebras de linha
```

**Consequência**: O Azure recebe o certificado com quebras de linha, resultando em:
```json
{"error":{"code":"Request_BadRequest","message":"Unexpected invalid input parameters."}}
```

### Problema 2: addKey Requer Proof JWT
O endpoint `addKey` requer um `proof` JWT assinado quando chamado via client credentials. Este é um mecanismo de segurança do Azure para evitar que aplicações adicionem suas próprias credenciais sem prova de posse.

### Problema 3: PATCH Requer Permissão
O fallback via PATCH requer a permissão `Application.ReadWrite.OwnedBy`:
```json
{"error":{"code":"Authorization_RequestDenied","message":"Insufficient privileges to complete the operation."}}
```

---

## Solução

Corrigir o regex e usar o endpoint PATCH diretamente (que é mais simples), mas garantir que a permissão `Application.ReadWrite.OwnedBy` esteja concedida no Azure.

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-heartbeat/index.ts` | Corrigir regex e simplificar fluxo |

---

## Mudanças Necessárias

### 1. Corrigir Regex (Linha 208)

**Antes:**
```typescript
let certBase64 = publicKey
  .replace(/-----BEGIN CERTIFICATE-----/g, '')
  .replace(/-----END CERTIFICATE-----/g, '')
  .replace(/\\s+/g, '');  // BUG: escape duplo
```

**Depois:**
```typescript
let certBase64 = publicKey
  .replace(/-----BEGIN CERTIFICATE-----/g, '')
  .replace(/-----END CERTIFICATE-----/g, '')
  .replace(/\s+/g, '');   // CORRETO: remove whitespace
```

### 2. Usar PATCH Diretamente (Simplificar)

O endpoint `addKey` é mais complexo e requer proof JWT. Vamos usar PATCH diretamente, que funciona com a permissão `Application.ReadWrite.OwnedBy`:

```typescript
async function uploadAgentCertificate(...) {
  // ... (código de autenticação permanece igual)
  
  // Format certificate for Azure (remove headers and ALL whitespace)
  const certBase64 = publicKey
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');  // CORRETO: remove espaços e quebras de linha

  // Get current key credentials
  const getAppResponse = await fetch(
    `https://graph.microsoft.com/v1.0/applications/${globalConfig.app_object_id}?$select=keyCredentials`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!getAppResponse.ok) {
    console.error('Failed to get app credentials:', await getAppResponse.text());
    return null;
  }

  const appData = await getAppResponse.json();
  const existingKeys = appData.keyCredentials || [];

  // Add new key credential
  const newKey = {
    type: 'AsymmetricX509Cert',
    usage: 'Verify',
    key: certBase64,
    displayName: `iScope-Agent-${agentId.substring(0, 8)}`,
    startDateTime: new Date().toISOString(),
    endDateTime: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(), // 2 years
  };

  const patchResponse = await fetch(
    `https://graph.microsoft.com/v1.0/applications/${globalConfig.app_object_id}`,
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
    console.error('Failed to patch app credentials:', await patchResponse.text());
    return null;
  }

  // ... (resto do código permanece igual)
}
```

---

## Pré-Requisito: Permissão no Azure

Para que o PATCH funcione, é necessário que a permissão `Application.ReadWrite.OwnedBy` esteja concedida ao App Registration no Azure.

### Verificar no Azure Portal:
1. Ir para Azure AD > App registrations > InfraScope 360
2. API permissions
3. Verificar se `Application.ReadWrite.OwnedBy` está listada e com "Admin consent granted"

Se não estiver:
1. Add a permission > Microsoft Graph > Application permissions
2. Procurar por `Application.ReadWrite.OwnedBy`
3. Adicionar e conceder admin consent

---

## Resultado Esperado

Após a correção:

1. Regex corretamente remove quebras de linha do certificado
2. Usa PATCH diretamente (mais confiável que addKey)
3. Certificado é enviado em formato válido para o Azure
4. Azure aceita e registra o certificado
5. `azure_certificate_key_id` é salvo no banco
6. Agent recebe confirmação e para de enviar "Certificado pendente"

---

## Verificação

1. **Logs do Edge Function** - não deve mais mostrar "Request_BadRequest"
2. **Azure Portal** - App Registration deve mostrar nova chave de certificado
3. **Banco de dados:**
   ```sql
   SELECT name, certificate_thumbprint, azure_certificate_key_id 
   FROM agents WHERE name = 'PRECISIO-AZ'
   ```
4. **Logs do Agent** - não deve mais mostrar "Certificado pendente detectado"
