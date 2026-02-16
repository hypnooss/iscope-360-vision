

# Corrigir filtro de servicos que oculta portas sem "product"

## Problema

Na linha 892 do `AttackSurfaceAnalyzerPage.tsx`, o filtro `.filter(s => s.product)` remove servicos que nao possuem o campo `product` preenchido pelo Nmap. As portas 80 e 10443 provavelmente foram detectadas com um `name` (ex: "http", "https") mas sem `product`, entao sao completamente ocultadas da secao "Servicos e Tecnologias".

Apenas a porta 541 aparece porque o Nmap conseguiu identificar o product como "SSL/TLS ClientHello" (ou similar).

## Solucao

Alterar o filtro para mostrar servicos que tenham `product` OU `name` OU `scripts` -- qualquer dado relevante. Tambem ajustar o `matchCVEsToService` para considerar o `name` do servico.

## Plano Tecnico

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**Linha 892** - Alterar o filtro:

```typescript
// Antes:
{asset.services.filter(s => s.product).map((svc, i) => (

// Depois:
{asset.services.filter(s => s.product || s.name || (s.scripts && Object.keys(s.scripts).length > 0)).map((svc, i) => (
```

**Linha 893** - Ajustar o match de CVEs para considerar tambem o `name`:

```typescript
// Antes:
<NmapServiceRow key={`svc-${i}`} svc={svc} cves={matchCVEsToService(svc.product, asset.cves)} />

// Depois:
<NmapServiceRow key={`svc-${i}`} svc={svc} cves={matchCVEsToService(svc.product || svc.name || '', asset.cves)} />
```

## Resultado

Todas as portas com servicos detectados (mesmo sem `product` especifico) aparecerao na secao de Servicos, exibindo o `name` como fallback (ex: "http", "https", "ms-wbt-server").

| Arquivo | Mudanca |
|---|---|
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` | Relaxar filtro de servicos e usar `name` como fallback no match de CVEs |

