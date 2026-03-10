

## Correção: Drill-down de Detecção de Phishing sem dados

### Causa raiz

O drill-down de Phishing lê de `analyzerMetrics.phishing` (campos `topSenderDomains` e `topAttackedUsers`), que estão vazios no snapshot. Os dados reais de phishing estão em `analyzerMetrics.threatProtection`:

- **Alvos**: `threatProtection.topPhishingTargets` — 10 registros com users, counts e senders
- **Origens**: Não há campo dedicado a domínios de phishing, mas cada `topPhishingTargets[].senders` contém os domínios atacantes

### Correção

**`src/components/m365/exchange/ExchangeCategorySheet.tsx` (~linhas 295-303)**

1. **Domínios (Origens)**: Para `cat === 'phishing'`, extrair domínios únicos agregados de `threatData?.topPhishingTargets[].senders`, contando ocorrências por domínio, em vez de ler `phishingData?.topSenderDomains`

2. **Usuários (Alvos)**: Para `cat === 'phishing'`, usar `threatData?.topPhishingTargets` como fonte primária (já é fallback na linha 302, basta tornar primário)

Lógica de extração de domínios:
```typescript
// Agregar senders de todos os targets em um mapa domain → count
const phishSenderMap: Record<string, number> = {};
(threatData?.topPhishingTargets || []).forEach((t: any) => {
  (t.senders || []).forEach((s: string) => {
    phishSenderMap[s] = (phishSenderMap[s] || 0) + 1;
  });
});
const phishDomains = Object.entries(phishSenderMap)
  .sort((a, b) => b[1] - a[1])
  .map(([name, count]) => ({ name, count }));
```

Uma única alteração em um arquivo.

