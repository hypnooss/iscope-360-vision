
# Ajustes no Dashboard V3 - 3 Alteracoes

## 1. Substituir Severity Cards por Stats Cards gerais

Remover o componente `SeverityCards` (4 cards Critical/High/Medium/Low) e substituir por 4 cards informativos no estilo do V2:
- **Ativos Expostos** (icone Globe, cor teal) — total de ativos com servicos
- **Servicos Detectados** (icone Server, cor blue) — soma de services + webServices
- **CVEs Criticas** (icone ShieldAlert, cor red) — contagem de CVEs com severity "critical"
- **Certificados Expirados** (icone AlertTriangle, cor orange) — total de certs expirados

Isso requer adicionar o calculo de `assetStats` na V3 (copiar do V2) e criar os 4 `SummaryCard` inline ou como componente simples.

## 2. Adicionar linha de info "Ultima coleta" apos o progress bar

Mover o timestamp do rodape para logo abaixo do progress bar (ou abaixo do header se nao houver scan rodando), usando o mesmo padrao do Firewall Analyzer:

```text
Clock icon | Ultima coleta: [DD/MM/AAAA, HH:MM] | X coletas (se aplicavel)
```

Remover o bloco de "Ultimo scan concluido em..." do rodape (linhas 485-490).

## 3. Manter tudo o resto como esta

CategoryOverviewGrid, TopFindingsList, AssetHealthGrid e CategoryDetailSheet permanecem inalterados.

## Detalhes Tecnicos

### Arquivo: `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`

**Adicionar calculo de assetStats** (copiar do V2):
```typescript
const assetStats = useMemo(() => {
  let totalServices = 0, expiredCerts = 0, criticalCVEs = 0;
  for (const a of assets) {
    totalServices += a.services.length + a.webServices.length;
    expiredCerts += a.expiredCerts;
    for (const cve of a.cves) {
      if ((cve.severity || '').toLowerCase() === 'critical') criticalCVEs++;
    }
  }
  return { totalAssets: assets.length, totalServices, expiredCerts, criticalCVEs };
}, [assets]);
```

**Substituir `<SeverityCards>` por 4 SummaryCards** com os dados acima.

**Adicionar linha de info** entre progress e conteudo principal:
- Usar `snapshot.completed_at` formatado como Badge
- Icone `Clock` + texto "Ultima coleta:" + Badge com data
- Query para contar total de snapshots do cliente (opcional)

**Remover bloco do rodape** (linhas 485-490 atuais).

### Arquivos afetados

| Arquivo | Acao |
|---|---|
| `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx` | Modificar (stats cards, info line, remover rodape) |

O componente `SeverityCards.tsx` pode ser mantido no codigo (pode ser util no futuro) mas nao sera mais importado na V3.
