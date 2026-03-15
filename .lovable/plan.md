

## Corrigir detecção incorreta de N/A nos cards de Firewall Insights

### Problema

A função `isNAInsight()` em `SecurityInsightCard.tsx` classifica insights como N/A quando:
1. O nome contém palavras como "desabilitado" (ex: "2FA Desabilitado com Brute Force Ativo")
2. `count` é `undefined` e não há `affectedUsers` — que é o caso de todos os insights de firewall, já que removemos `count` do mapeamento

Isso faz com que insights de firewall com severidade real (critical, high, medium) apareçam como N/A.

### Solução

Duas correções complementares:

| Arquivo | Alteração |
|---|---|
| `src/components/m365/shared/SecurityInsightCard.tsx` | Ajustar `isNAInsight()` para respeitar o `status` explícito do insight: se `status === 'fail'`, retornar `false` imediatamente (não é N/A). A heurística de keywords e count só deve se aplicar quando o status não está explicitamente definido. |

A lógica ficaria:
```typescript
function isNAInsight(insight: M365AnalyzerInsight): boolean {
  if (insight.status === 'pass') return false;
  if (insight.status === 'fail') return false;        // ← NOVO
  if (insight.status === 'not_applicable') return true;
  // ... resto da heurística para insights sem status explícito
}
```

Isso garante que insights de firewall (e qualquer outro módulo) que tenham `status: 'fail'` explícito nunca sejam classificados como N/A, independentemente do nome ou da ausência de `count`.

