

# Pagina de CVEs - Firewall (FortiOS)

## Objetivo

Criar uma pagina dedicada em `/scope-firewall/cves` que agrega e exibe todos os CVEs conhecidos para as versoes de firmware FortiOS dos firewalls cadastrados, seguindo o mesmo padrao visual da pagina `M365CVEsPage`.

## Fonte de dados

A versao de firmware de cada firewall esta armazenada em `analysis_history.report_data->>'firmwareVersion'`. A pagina ira:
1. Buscar as versoes de firmware distintas (da ultima analise de cada firewall)
2. Para cada versao, chamar a Edge Function `fortigate-cve` que consulta o NIST NVD
3. Agregar todos os CVEs e exibir de forma unificada, com filtro por versao

## Estrutura da pagina

- Breadcrumb: Scope Firewall > CVEs
- Titulo: "CVEs - FortiOS"
- Subtitulo: "Vulnerabilidades conhecidas nas versoes de firmware dos firewalls cadastrados"
- StatCards interativos para filtro por severidade (Total, Criticos, Altos, Medios, Baixos) - mesmo padrao do M365CVEsPage
- Filtro por versao de firmware (chips/botoes) - similar ao filtro de produtos do M365
- Lista de CVEs usando componente Collapsible com card expansivel
- Disclaimer do NIST NVD no rodape

## Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| `src/hooks/useFirewallCVEs.ts` | **Criar** - Hook que busca versoes de firmware distintas do banco e chama `fortigate-cve` para cada versao, agregando os resultados |
| `src/pages/firewall/FirewallCVEsPage.tsx` | **Criar** - Pagina principal seguindo o layout padrao (`p-6 lg:p-8 space-y-6`) e reutilizando o padrao visual do M365CVEsPage |
| `src/App.tsx` | **Modificar** - Adicionar lazy import e rota `/scope-firewall/cves` |
| `src/components/layout/AppLayout.tsx` | **Modificar** - Adicionar item "CVEs" no menu lateral do modulo `scope_firewall`, apos "Firewalls" |

## Detalhes tecnicos

### Hook `useFirewallCVEs`

```text
1. Query no Supabase para buscar a ultima analise de cada firewall:
   - SELECT DISTINCT ON (firewall_id) firewall_id, report_data->>'firmwareVersion'
   - FROM analysis_history ORDER BY firewall_id, created_at DESC

2. Para cada versao unica, invocar supabase.functions.invoke('fortigate-cve', { body: { version } })

3. Agregar todos os CVEs, adicionando campo 'firmwareVersion' a cada CVE para permitir filtragem

4. Retornar: { cves, versions, isLoading, error }
```

### Pagina `FirewallCVEsPage`

- Layout identico ao M365CVEsPage (container, header, stats, filtros, lista)
- StatCards: Total, Criticos, Altos, Medios, Baixos (sem "Acao Necessaria" pois nao se aplica ao FortiOS)
- Filtro de versao: chips com as versoes de firmware encontradas (ex: "7.4.11", "7.2.12")
- Card de CVE: reutiliza o mesmo padrao Collapsible com Badge de severidade, link externo para NVD, versoes afetadas e descricao expansivel
- Link de referencia aponta para Fortiguard PSIRT em vez de MSRC

### Menu lateral

Adicionar entre "Firewalls" e "Execucoes":
```text
scope_firewall items:
  - Firewalls  -> /scope-firewall/firewalls
  - CVEs       -> /scope-firewall/cves      (NOVO)
  - Execucoes  -> /scope-firewall/executions
  - Relatorios -> /scope-firewall/reports
```

