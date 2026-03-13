

## Correção dos DataSourceDots na seção "Status das Políticas de Proteção"

### Problema
1. O subtítulo "STATUS DAS POLÍTICAS DE PROTEÇÃO" tem um ponto roxo (`analyzed`) na frente — não deveria ter nenhum ponto no título da seção
2. Cada **PolicyCard** (Anti-Spam, Anti-Phishing, etc.) deveria ter um ponto verde (`snapshot`) — são dados da última coleta
3. Cada **RankingList** (Top Origem Malware, Top Origem SPAM, Top Alvos Phishing) deveria ter um ponto azul (`aggregated`) — são dados agregados do período

### Alterações em `ExchangeThreatProtectionSection.tsx`

1. **Remover** o `<DataSourceDot source="analyzed" />` da linha 378 (ao lado do título da seção)

2. **PolicyCard**: Adicionar `<DataSourceDot source="snapshot" />` no canto superior direito de cada card (mesmo padrão dos stats cards), posicionado com `absolute top-2 right-2`

3. **RankingList**: Adicionar `<DataSourceDot source="aggregated" />` ao lado do título do card no `CardHeader`

