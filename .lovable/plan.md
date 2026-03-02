

## Corrigir: barra de progresso não reconhece status `cancelled`

### Problema

Na linha 151 de `M365PosturePage.tsx`, o polling só reconhece `completed` e `failed` como estados terminais:

```typescript
if (status === 'completed' || status === 'failed') {
```

Quando a tarefa é cancelada, o status no banco muda para `cancelled`, mas o frontend ignora esse valor e continua polling indefinidamente.

### Correção

**Arquivo**: `src/pages/m365/M365PosturePage.tsx`

**1. Linha 151 — Adicionar `cancelled` aos estados terminais:**

```typescript
if (status === 'completed' || status === 'failed' || status === 'cancelled') {
```

**2. Adicionar toast informativo para cancelamento** (dentro do mesmo bloco):

```typescript
if (status === 'cancelled') {
  toast({ title: 'Análise cancelada', description: 'A análise foi cancelada pelo usuário.' });
}
```

**3. Linha 228 — Incluir `cancelled` na lógica de `agent_status`** (que foi planejada anteriormente para tratar `partial` + `agent_status: failed/timeout`):

Garantir que a condição completa inclua:
```typescript
const isFinished = status === 'completed' || status === 'failed' || status === 'cancelled'
  || (status === 'partial' && ['failed', 'timeout', 'completed'].includes(agentSt));
```

Mudança mínima — uma linha principal + toast.

