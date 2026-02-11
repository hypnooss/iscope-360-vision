

# Administracao > CVEs - Lista detalhada de CVEs individuais

## Problema

A pagina atual exibe dados agregados da tabela `cve_severity_cache` (contagens por workspace), mas o usuario quer ver as CVEs individuais com todos os detalhes: ID, pontuacao CVSS, severidade, descricao, produtos afetados, data de publicacao, links para advisory.

## O que o cache realmente armazena

A tabela `cve_severity_cache` armazena apenas:
- Contagens por severidade (critical, high, medium, low, total)
- Top 2 CVEs (apenas id + score + severity, sem descricao)
- Modulo e client_id

Os detalhes completos das CVEs sao obtidos em tempo real pelas Edge Functions `fortigate-cve` (NVD API) e `m365-cves` (MSRC API).

## Solucao

Redesenhar completamente `CVEsCachePage.tsx` para buscar dados ao vivo das mesmas Edge Functions que as paginas de modulo usam, combinando tudo numa unica lista unificada.

### Fonte de dados

| Modulo | Edge Function | Dados retornados |
|---|---|---|
| Firewall | `fortigate-cve` (via `useFirewallCVEs`) | id, description, severity, score, publishedDate, affectedVersions, references, vendor |
| M365 | `m365-cves` (via `useM365CVEs`) | id, title, severity, score, publishedDate, products, description, advisoryUrl, customerActionRequired |

### Layout da nova pagina

1. **Breadcrumb**: Administracao > CVEs
2. **Header**: titulo + subtitulo "Todas as vulnerabilidades monitoradas na plataforma"
3. **Cards de resumo** (5 cards): Total, Criticos, Altos, Medios, Baixos (calculados a partir dos dados ao vivo, clicaveis para filtrar)
4. **Filtros**:
   - Busca textual (por CVE ID ou descricao)
   - Filtro por modulo (Todos / Firewall / M365)
   - Filtro por severidade (via StatCards clicaveis)
5. **Lista de CVEs**: Cards expandiveis (Collapsible) mostrando:
   - Badge de severidade + badge do modulo (Firewall/M365)
   - CVE ID clicavel (link para NVD ou MSRC)
   - Score CVSS
   - Titulo/descricao resumida
   - Produtos afetados (M365) ou versao de firmware (Firewall)
   - Data de publicacao
   - Ao expandir: descricao completa + links para advisories

### Unificacao dos dados

As CVEs de ambos os modulos serao normalizadas para um tipo unificado:

```text
UnifiedCVE {
  id: string           // CVE-XXXX-XXXXX
  module: 'firewall' | 'm365'
  severity: string
  score: number | null
  title: string
  description: string
  publishedDate: string
  products: string[]   // M365: produtos cloud, Firewall: "FortiOS 7.x.x"
  advisoryUrl: string
  isNew: boolean       // publicado nos ultimos 30 dias
}
```

A lista e ordenada por score (maior primeiro), com fallback por severidade.

## Arquivos a modificar

| Arquivo | Acao |
|---|---|
| `src/pages/admin/CVEsCachePage.tsx` | Reescrever completamente - buscar dados ao vivo das Edge Functions, exibir CVEs individuais com detalhes |

Nenhum arquivo novo necessario. Nenhuma alteracao no banco de dados. Rota e menu ja estao configurados.

## Detalhes tecnicos

- Reutiliza os hooks `useFirewallCVEs()` e `useM365CVEs()` para buscar dados
- Combina e deduplica os resultados numa lista unificada
- Mantém `staleTime` de 30 min (ja configurado nos hooks) para evitar chamadas excessivas as APIs
- Componente `CVECard` similar ao das paginas de modulo mas com badge indicando a origem (Firewall/M365)
- StatCards clicaveis para filtrar por severidade (mesmo padrao das paginas existentes)

