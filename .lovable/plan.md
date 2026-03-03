

## Documentacao Tecnica - Nova Aba Administrativa

### Resumo

Criar uma nova pagina `/docs` na area administrativa com documentacao tecnica completa do sistema, organizada por modulos com navegacao lateral, busca, e conteudo estruturado.

### Arquivos a Criar

**1. `src/pages/admin/TechnicalDocsPage.tsx`** — Pagina principal
- Layout com sidebar esquerda (lista de modulos/secoes) e area de conteudo principal
- Campo de busca que filtra secoes por palavra-chave
- Indicador de versao (v1.0.0) e data de ultima atualizacao
- Botao "Exportar PDF" (placeholder para futuro)
- Conteudo em Accordion/Collapsible por secao padrao (Visao Geral, Arquitetura, Coleta, Motor de Regras, Modelo Matematico, Alertas, Seguranca, Performance)

**2. `src/data/technicalDocs.ts`** — Dados da documentacao
- Estrutura tipada com todos os modulos e suas secoes
- Conteudo detalhado para cada modulo:
  - Dominio Externo (Compliance, Analyzer)
  - Firewall (Compliance, Analyzer, CVEs)
  - Microsoft 365 (Compliance, Analyzer, CVEs, Entra ID, Exchange Online)
  - Gestao de Ativos
  - Dashboard Executivo
  - Autenticacao
  - Integracoes
- Cada modulo contem as 8 secoes padronizadas com texto tecnico, diagramas em formato textual, formulas matematicas, limitacoes e roadmap

### Arquivos a Modificar

**3. `src/components/layout/AppLayout.tsx`**
- Adicionar `BookOpen` (lucide) ao import
- Adicionar `/docs` na detecao de rota admin (linha 220 e 459)
- Adicionar link "Documentacao" no menu admin (hover card e collapsible), entre as entradas existentes

**4. `src/App.tsx`**
- Adicionar lazy import do `TechnicalDocsPage`
- Adicionar rota `/docs`

### Estrutura da Interface

```text
+-------------------+--------------------------------------+
| [Busca...]        | Modulo: Firewall > Compliance   v1.0 |
|                   | Ultima atualizacao: 2026-03-03       |
| Dominio Externo   |                                      |
|   Compliance      | > Visao Geral          [expandido]   |
|   Analyzer        |   Objetivo, problema, dependencias   |
|                   |                                      |
| Firewall          | > Arquitetura Tecnica  [colapsado]   |
|   Compliance      | > Coleta de Dados      [colapsado]   |
|   Analyzer        | > Motor de Regras      [colapsado]   |
|   CVEs            | > Modelo Matematico    [colapsado]   |
|                   | > Tipos de Alertas     [colapsado]   |
| Microsoft 365     | > Seguranca/Compliance [colapsado]   |
|   Compliance      | > Performance          [colapsado]   |
|   Analyzer        | > Limitacoes           [colapsado]   |
|   CVEs            | > Roadmap              [colapsado]   |
|   Entra ID        |                                      |
|   Exchange Online |          [Exportar PDF]              |
|                   |                                      |
| Gestao de Ativos  |                                      |
| Dashboard         |                                      |
| Autenticacao      |                                      |
| Integracoes       |                                      |
+-------------------+--------------------------------------+
```

### Conteudo Tecnico

Cada modulo tera documentacao real baseada na arquitetura existente do sistema:

- **Firewall Compliance**: Coleta via Agent (FortiOS API), 80+ regras estaticas, score 0-100, evidencias por interface/politica
- **Firewall Analyzer**: Motor baseline comportamental, detecao de anomalias, correlacao de eventos
- **Firewall CVEs**: Cache de CVEs FortiGuard, scoring CVSS, verificacao de firmware
- **M365 Compliance**: Graph API + PowerShell via Agent, insights de postura, Secure Score
- **M365 Analyzer**: Baseline comportamental por usuario (Z-Score), detecao de exfiltracao, janela 30 dias
- **M365 CVEs**: CVEs Microsoft, correlacao com licencas
- **Entra ID**: Analise de usuarios, MFA, apps, conditional access
- **Exchange Online**: Analise de transporte, anti-spam, DKIM/DMARC
- **Dominio Externo Compliance**: DNS, SSL, headers HTTP, subdominios (Amass)
- **Dominio Externo Analyzer**: Attack Surface scanning (Nmap, Masscan, SNMP)
- **Gestao de Ativos**: Licensing hub, controle de licencas por workspace
- **Dashboard Executivo**: Agregacao multi-modulo, sparklines, score geral
- **Autenticacao**: Supabase Auth, RBAC (super_admin, workspace_admin, user), RLS
- **Integracoes**: Supabase Edge Functions, Agent Python, Supervisor

Secao de Modelo Matematico incluira as formulas de media, desvio padrao, Z-Score e classificacao conforme especificado.

### Funcionalidades

- Busca global filtra modulos e secoes por texto
- Accordion com expansao/colapso por secao
- Navegacao lateral com destaque do modulo ativo
- Versao e data de atualizacao por modulo
- Historico de mudancas (changelog) em cada modulo
- Estrutura preparada para versionamento futuro (dados em arquivo separado, facilmente migravel para banco)

### Escopo

- Pagina 100% frontend (dados em arquivo TypeScript)
- Acessivel apenas para `super_admin`
- ~4 arquivos tocados, ~2 novos

