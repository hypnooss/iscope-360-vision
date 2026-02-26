

## Correção: m365-analyzer deve usar raw_data do agent

### Problema

O fluxo atual:
1. Agent coleta dados via Graph API (18 steps, 14 com sucesso) usando autenticação por certificado
2. `agent-task-result` envia os dados coletados (`raw_data`) para `m365-analyzer`
3. `m365-analyzer` **ignora o raw_data** e tenta buscar dados diretamente da Graph API com `client_secret`
4. A autenticação por `client_secret` falha (tenant usa certificado) --> snapshot marcado como `failed`

Os logs confirmam:
- `agent-task-result`: "Reconstructed raw_data from 18 steps, 14 successful"
- `m365-analyzer`: snapshot falha com `{"error": "Failed to get Graph API token"}`

### Solução

Modificar `supabase/functions/m365-analyzer/index.ts` para:

1. **Aceitar `raw_data` do body da requisição** (enviado pelo `agent-task-result`)
2. **Usar `raw_data` como fonte primária** quando disponível
3. **Fallback para Graph API direta** apenas quando `raw_data` não é fornecido (ex: execução manual sem agent)

### Detalhes técnicos

**Arquivo: `supabase/functions/m365-analyzer/index.ts`**

Alteração principal no handler (linhas ~580-660):

```text
Antes:
  req.json() → extrai apenas snapshot_id
  → sempre tenta getGraphToken()
  → coleta dados via Graph API
  → analisa

Depois:
  req.json() → extrai snapshot_id + raw_data
  → SE raw_data existe:
      → mapeia step results para variáveis de dados
        (emailActivity, mailboxUsage, signInLogs, auditLogs)
      → pula Graph API
  → SENÃO:
      → tenta getGraphToken() e coleta via Graph API (comportamento atual)
  → analisa normalmente com os dados obtidos
```

Mapeamento de `raw_data` (baseado nos step IDs do blueprint do agent):
- Steps com dados de email activity → `emailActivity`
- Steps com dados de mailbox → `mailboxUsage`
- Steps com sign-in logs → `signInLogs`
- Steps com audit logs → `auditLogs`
- Steps com threat data → `threatData`

O `raw_data` é um objeto onde cada chave é o `step_id` e o valor são os dados coletados pelo agent naquele step. A função precisa extrair os arrays relevantes de cada step.

**Arquivo: `supabase/functions/m365-analyzer/index.ts`** - redeploy necessário após alteração.

### Resultado esperado

- Próxima execução: agent coleta dados (certificado) → `agent-task-result` envia raw_data → `m365-analyzer` processa os dados do agent → snapshot `completed` com score e insights
- Dashboard exibe os resultados normalmente
