

# Card de Detecções de Botnet — Sugestão

## Dados disponíveis

O sistema já coleta:
- **Total de detecções** (`botnetDetections`)
- **Top domínios C&C** (`botnetDomains[]` com domain + count)

## Proposta para o card

Aplicar o **mesmo padrão** dos cards de Filtragem Web, Controle de Apps e Anomalias:

1. **Barra proporcional** — segmentos coloridos representando os top 3 domínios de botnet detectados
2. **Badges coloridas individuais** — cada badge mostra o domínio C&C e a contagem (ex: "12 malware-c2.example.com", "5 botnet-relay.net")
3. Se não houver domínios mas houver detecções, mostrar badge "Critical" vermelha (como já faz)

## Alteração

**Arquivo:** `src/components/firewall/AnalyzerCategoryGrid.tsx`

No case `'botnet'` do `getCategoryStats`, popular `topItems` com os top 3 de `metrics.botnetDomains`:

```ts
case 'botnet': {
  const botnet = metrics.botnetDetections || 0;
  const topItems = (metrics.botnetDomains || [])
    .slice(0, 3)
    .map(d => ({ label: d.domain, count: d.count }));
  return {
    total: botnet,
    severity: botnet > 0 ? 'critical' : 'none',
    topItems,
  };
}
```

Nenhuma outra alteração necessária — a renderização de barra proporcional e badges coloridas já funciona automaticamente quando `topItems` está presente.

