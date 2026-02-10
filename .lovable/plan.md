

# Adicionar tag "NEW" em CVEs com menos de 30 dias

## O que muda

CVEs publicadas nos ultimos 30 dias exibirao uma badge verde "NEW" ao lado das badges de severidade e acao necessaria, chamando atencao visual para vulnerabilidades recentes.

## Alteracao tecnica

**Arquivo:** `src/pages/m365/M365CVEsPage.tsx`

1. No componente `CVECard`, calcular se o CVE tem menos de 30 dias comparando `cve.publishedDate` com a data atual
2. Renderizar uma badge "NEW" com estilo verde (bg-emerald-500 text-white) logo apos a badge de severidade, antes da badge de "Acao Necessaria"

A badge usara um estilo com leve animacao de pulso (animate-pulse) para chamar mais atencao durante a navegacao.

Ordem das badges no card:
```
[SEVERITY] [NEW] [Acao Necessaria] [CVSS score] [CVE-ID]
```

Nenhuma alteracao no backend ou no hook -- o campo `publishedDate` ja existe nos dados retornados.

