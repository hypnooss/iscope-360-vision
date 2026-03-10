

## Correção: Drill-down de Detecção de Malware sem dados

### Causa raiz

O drill-down de Malware lê campos que não existem no objeto `threatProtection`:

- **Linha 311**: lê `threatData?.topMalwareSenderDomains` → campo correto é `topMalwareSenders`
- **Linha 316**: lê `threatData?.topMalwareRecipients` → não existe; os alvos estão em `topMalwareSenders[].recipients`

### Correção

**`src/components/m365/exchange/ExchangeCategorySheet.tsx`**

1. **Top Domínios (linha 311)**: Trocar `topMalwareSenderDomains` por `topMalwareSenders`, mapeando `d.domain` como nome
2. **Top Usuários Alvos (linha 316)**: Agregar `recipients` de todos os `topMalwareSenders` num mapa `user → count` (mesmo padrão usado para phishing com `senders`), gerando a lista de alvos

Lógica de agregação dos alvos:
```typescript
const malwareTargetMap: Record<string, number> = {};
(threatData?.topMalwareSenders || []).forEach((d: any) => {
  (d.recipients || []).forEach((r: string) => {
    malwareTargetMap[r] = (malwareTargetMap[r] || 0) + 1;
  });
});
const malwareTargets = Object.entries(malwareTargetMap)
  .sort((a, b) => b[1] - a[1])
  .map(([name, count]) => ({ name, count }));
```

