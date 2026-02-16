
# Corrigir breadcrumb: "Relatórios" para "Compliance"

## Resumo

Na pagina de relatorio de analise de dominio externo (`ExternalDomainAnalysisReportPage.tsx`), o breadcrumb exibe "Relatórios" mas deveria exibir "Compliance", consistente com a renomeacao feita anteriormente.

## Mudancas

### Arquivo: `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`

Alterar o label do breadcrumb de `'Relatórios'` para `'Compliance'` em dois locais:

- **Linha 604**: Estado de fallback (quando nao ha relatorio)
- **Linha 633**: Estado principal (exibicao do relatorio)

Ambos mantem o `href: '/scope-external-domain/reports'` inalterado, pois a rota continua a mesma.
