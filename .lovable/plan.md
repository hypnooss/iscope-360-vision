

# Corrigir alternancia de dados durante scan em andamento

## Problema

Quando o scan esta rodando, o `activeSnapshot` alterna entre o snapshot running (que pode ter `results` vazio no inicio) e o snapshot completo anterior. Isso faz com que a pagina as vezes mostre dados (print 2) e as vezes mostre "Nenhum dado disponivel" (print 1).

A logica atual e:
```
const activeSnapshot = isRunning && runningSnapshot ? runningSnapshot : snapshot;
```

Quando `runningSnapshot` existe mas ainda nao tem tasks completadas, ele tem `results: {}` -- e os stats mostram tudo zero.

## Solucao

Mudar a logica para so usar o `runningSnapshot` quando ele tiver resultados parciais. Se nao tiver, manter o ultimo snapshot completo como visivel:

```typescript
const hasPartialResults = runningSnapshot && Object.keys(runningSnapshot.results || {}).length > 0;
const activeSnapshot = isRunning && hasPartialResults ? runningSnapshot : snapshot;
```

Assim:
- No inicio do scan (0 tasks completas): mostra dados do ultimo scan completo
- Assim que o primeiro IP termina: troca para os dados parciais do scan em andamento
- Apos conclusao: volta para o snapshot completo atualizado

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Modificar a linha 1170:

**De:**
```typescript
const activeSnapshot = isRunning && runningSnapshot ? runningSnapshot : snapshot;
```

**Para:**
```typescript
const hasPartialResults = runningSnapshot && Object.keys(runningSnapshot.results || {}).length > 0;
const activeSnapshot = isRunning && hasPartialResults ? runningSnapshot : snapshot;
```

### Arquivo unico

| Arquivo | Acao |
|---|---|
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` | Ajustar condicao do `activeSnapshot` para verificar se ha resultados parciais |

