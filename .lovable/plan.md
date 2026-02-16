

# Auto-refresh do snapshot apos rescan completar

## Problema

O hook `useLatestAttackSurfaceSnapshot` nao faz polling. Quando o agente termina o rescan e faz merge no snapshot, o frontend nao sabe que os dados mudaram. O usuario precisa recarregar a pagina manualmente.

## Solucao

Usar o hook `useAttackSurfaceProgress` (que ja faz polling a cada 10s) para detectar quando o status volta para `completed` e invalidar automaticamente as queries do snapshot.

## Plano Tecnico

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Adicionar um `useEffect` que observa o resultado do `useAttackSurfaceProgress`. Quando o status mudar para `completed`, invalida as queries do snapshot para forcar o re-fetch.

```typescript
const queryClient = useQueryClient();
const progress = useAttackSurfaceProgress(clientId);

useEffect(() => {
  if (progress.data?.status === 'completed') {
    queryClient.invalidateQueries({ queryKey: ['attack-surface-latest', clientId] });
    queryClient.invalidateQueries({ queryKey: ['attack-surface-snapshots', clientId] });
  }
}, [progress.data?.status, clientId, queryClient]);
```

Para evitar invalidacoes desnecessarias (quando o status ja era `completed` antes), guardar o status anterior com `useRef`:

```typescript
const prevStatus = useRef<string | null>(null);

useEffect(() => {
  const currentStatus = progress.data?.status ?? null;
  // So invalida na transicao running/pending -> completed
  if (currentStatus === 'completed' && prevStatus.current && prevStatus.current !== 'completed') {
    queryClient.invalidateQueries({ queryKey: ['attack-surface-latest', clientId] });
    queryClient.invalidateQueries({ queryKey: ['attack-surface-snapshots', clientId] });
  }
  prevStatus.current = currentStatus;
}, [progress.data?.status, clientId, queryClient]);
```

### Resumo

| Arquivo | Mudanca |
|---|---|
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` | Adicionar `useEffect` + `useRef` para detectar transicao de status e invalidar queries do snapshot automaticamente |

Nenhuma outra mudanca necessaria. O card sera atualizado automaticamente ~10 segundos apos o agente concluir o rescan (proximo tick do polling de progresso).

