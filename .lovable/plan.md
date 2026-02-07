

# Plano: Corrigir Erro de Sintaxe e Verificar Permissões do Azure

## Problema 1: Código Duplicado (BOOT_ERROR)

O arquivo `agent-heartbeat/index.ts` contém código duplicado após um `return`, causando o erro de sintaxe:

```
SyntaxError: Identifier 'keyId' has already been declared at line 174
```

### Código Problemático (Linhas 257-287)

```typescript
// Linha 257: PRIMEIRA declaração
const keyId = `agent-${agentId.substring(0, 8)}-${thumbprint.substring(0, 8)}`;

// ... código de update ...

console.log(`Certificate uploaded for agent ${agentId}, keyId: ${keyId}`);
return keyId;  // Linha 270: RETURN

// CÓDIGO MORTO ABAIXO (deveria ter sido removido)
// Parse response from addKey
const uploadData = await uploadResponse.json();
const keyId = uploadData.keyId || ...;  // Linha 274: SEGUNDA declaração (ERRO!)
```

---

## Problema 2: Permissão do Azure

O log mostra:
```json
{"error":{"code":"Authorization_RequestDenied","message":"Insufficient privileges to complete the operation."}}
```

A permissão `Application.ReadWrite.OwnedBy` só funciona se:
1. O App Registration foi criado pelo próprio app (improvável)
2. Ou foi explicitamente adicionado como owner

**Solução alternativa**: Usar a permissão `Application.ReadWrite.All` que é mais ampla, ou adicionar o app como owner do próprio registro.

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-heartbeat/index.ts` | Remover código duplicado (linhas 272-287) |

---

## Mudança Necessária

### Remover código morto (Linhas 272-287)

O bloco abaixo deve ser **removido completamente**:

```typescript
// REMOVER: Este código está após um return e nunca executa
// Parse response from addKey
const uploadData = await uploadResponse.json();
const keyId = uploadData.keyId || `agent-${agentId.substring(0, 8)}-${thumbprint.substring(0, 8)}`;

// Update agent record with certificate info
await supabase
  .from('agents')
  .update({
    certificate_thumbprint: thumbprint,
    certificate_public_key: publicKey,
    azure_certificate_key_id: keyId,
  })
  .eq('id', agentId);

console.log(`Certificate uploaded for agent ${agentId}, keyId: ${keyId}`);
return keyId;
```

---

## Sobre a Permissão do Azure

Após corrigir o erro de sintaxe, o próximo passo é resolver a permissão. Opções:

| Opção | Descrição | Recomendação |
|-------|-----------|--------------|
| A | Adicionar app como Owner do próprio App Registration no Azure Portal | Simples, não requer permissão extra |
| B | Usar `Application.ReadWrite.All` em vez de `Application.ReadWrite.OwnedBy` | Mais ampla, pode ser overkill |

**Recomendo Opção A**: No Azure Portal, vá em App registrations > InfraScope 360 > Owners > Add owners > adicione o próprio Service Principal do app.

---

## Resultado Esperado

Após a correção:

1. Edge function inicia sem erro de sintaxe
2. Heartbeat processa normalmente
3. Se permissão estiver correta, certificado é registrado no Azure
4. `azure_certificate_key_id` é salvo no banco

---

## Verificação

1. **Logs da Edge Function** - não deve mais mostrar "Identifier 'keyId' has already been declared"
2. **Logs do Agent** - não deve mais mostrar "BOOT_ERROR"
3. Após ajuste de permissão no Azure, verificar se certificado aparece no App Registration

