

# Breadcrumb "Dominio Externo" - hover sem navegacao

## Resumo

Remover o `href` do item "Dominio Externo" em todas as paginas de Dominio Externo, e ajustar o componente `PageBreadcrumb` para que itens sem `href` (que nao sao o ultimo item) tenham efeito visual de hover mas sem acao de clique.

## Mudancas

### 1. PageBreadcrumb - hover em itens sem link

No componente `src/components/layout/PageBreadcrumb.tsx`, o caso de item intermediario sem `href` atualmente renderiza:
```text
<span className="text-muted-foreground">{item.label}</span>
```

Adicionar classe de hover para manter o efeito visual:
```text
<span className="text-muted-foreground hover:text-primary transition-colors cursor-default">{item.label}</span>
```

Isso garante que qualquer subpagina futura de Dominio Externo (ou outro modulo) que nao passe `href` tera automaticamente o hover sem navegacao.

### 2. Remover href de "Dominio Externo" em 6 arquivos

Remover `href: '/scope-external-domain/domains'` do primeiro item do breadcrumb nos seguintes arquivos:

| Arquivo | Linha aprox. |
|---|---|
| `ExternalDomainListPage.tsx` | 386 |
| `ExternalDomainReportsPage.tsx` | 358 |
| `AttackSurfaceAnalyzerPage.tsx` | 1227 |
| `ExternalDomainExecutionsPage.tsx` | 509 |
| `ExternalDomainEditPage.tsx` | 249 |
| `ExternalDomainAnalysisReportPage.tsx` | 603, 632 |

Cada um mudara de:
```text
{ label: 'Dominio Externo', href: '/scope-external-domain/domains' }
```
Para:
```text
{ label: 'Dominio Externo' }
```

