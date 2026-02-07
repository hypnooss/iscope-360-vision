
# Plano: Corrigir Formato de Data do Certificado no Azure

## Problema Identificado

Os logs mostram claramente o erro:
```json
{"error":{"code":"KeyCredentialsInvalidEndDate","message":"Key credential end date is invalid."}}
```

**Causa raiz**: O Azure limita a validade máxima de certificados a **1 ano** a partir da data de início. O código atual define 730 dias (2 anos), que é rejeitado.

### Código Problemático (linha 234)
```typescript
endDateTime: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(), // 2 years
```

---

## Solução

Reduzir a validade do certificado de 2 anos para **1 ano** (365 dias ou menos).

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-heartbeat/index.ts` | Alterar validade para 365 dias |

---

## Mudança Necessária

### Linha 234 - Alterar período de validade

**Antes:**
```typescript
endDateTime: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(), // 2 years
```

**Depois:**
```typescript
endDateTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year (Azure max)
```

---

## Impacto

- O certificado será válido por 1 ano em vez de 2
- O upload para o Azure será aceito
- `azure_certificate_key_id` será salvo no banco
- Agent parará de enviar "Certificado pendente" nos heartbeats

---

## Consideração Futura

Os certificados precisarão ser renovados anualmente. Pode-se implementar:
1. Alerta quando certificado estiver próximo de expirar (ex: 30 dias antes)
2. Renovação automática do certificado pelo agent

---

## Verificação

1. **Logs da Edge Function** - não deve mais mostrar "KeyCredentialsInvalidEndDate"
2. **Azure Portal** - App Registration deve mostrar o certificado registrado
3. **Banco de dados:**
   ```sql
   SELECT name, certificate_thumbprint, azure_certificate_key_id 
   FROM agents WHERE name = 'PRECISIO-AZ';
   ```
4. **Logs do Agent** - não deve mais mostrar "Certificado pendente detectado"
