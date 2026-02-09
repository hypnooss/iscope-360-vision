
# Corrigir Upload de Certificado e Garantir -File no Executor

## Problema 1: KeyCredentialsInvalidEndDate (BLOQUEANTE)

O upload do certificado ao Azure falha com erro `KeyCredentialsInvalidEndDate` porque o PATCH inclui keys existentes que podem ter datas expiradas. O Azure rejeita o request inteiro quando qualquer key no array tem data invalida.

Logs do backend:
```
PATCH error: 400 - {"error":{"code":"KeyCredentialsInvalidEndDate","message":"Key credential end date is invalid."}}
```

## Problema 2: Split-Path (PENDENTE DE DEPLOY)

A correcao de `-Command` para `-File` ja esta no repositorio mas o agente no servidor ainda roda v1.2.4. Apos atualizar o agente, o Split-Path sera resolvido.

## Solucao

### Arquivo: `supabase/functions/agent-heartbeat/index.ts`

Na logica de upload (linhas 276-285), filtrar keys expiradas ANTES de incluir no PATCH:

**Antes:**
```typescript
const cleanedExistingKeys = existingKeys.map((key: any) => ({
  type: key.type,
  usage: key.usage,
  key: key.key,
  customKeyIdentifier: key.customKeyIdentifier,
  displayName: key.displayName,
  startDateTime: key.startDateTime,
  endDateTime: key.endDateTime,
}));
```

**Depois:**
```typescript
const now = new Date();
const cleanedExistingKeys = existingKeys
  .filter((key: any) => {
    // Remove expired keys to avoid KeyCredentialsInvalidEndDate
    if (key.endDateTime) {
      const endDate = new Date(key.endDateTime);
      if (endDate < now) {
        console.log(`Removing expired key: ${key.displayName || 'unnamed'} (expired ${key.endDateTime})`);
        return false;
      }
    }
    return true;
  })
  .map((key: any) => ({
    type: key.type,
    usage: key.usage,
    key: key.key,
    customKeyIdentifier: key.customKeyIdentifier,
    displayName: key.displayName,
    startDateTime: key.startDateTime,
    endDateTime: key.endDateTime,
  }));
```

### Nenhuma mudanca adicional no Python Agent

A correcao do `-File` ja foi feita no commit anterior. So precisa atualizar o agente no servidor apos o deploy.

## Resumo

| Problema | Arquivo | Mudanca |
|----------|---------|---------|
| KeyCredentialsInvalidEndDate | `agent-heartbeat/index.ts` | Filtrar keys expiradas antes do PATCH |
| Split-Path | (ja corrigido) | Atualizar agente no servidor |

## Pos-Correcao

1. Deploy da edge function (automatico)
2. Aguardar proximo heartbeat (60s) - o certificado sera enviado e registrado com sucesso
3. Atualizar o agente no servidor para pegar a correcao do `-File`
4. Disparar nova analise M365
