

## Plano: Exportar CSV completo do template iScope — Dominio Externo

### O que sera exportado

O CSV sera dividido em **5 abas/arquivos** (ou 5 sheets num unico XLSX, que e mais pratico para esse volume de dados):

#### Sheet 1 — Regras de Compliance (26 regras ativas)
| Coluna | Campo |
|--------|-------|
| Codigo | code |
| Nome | name |
| Categoria | category |
| Severidade | severity |
| Peso | weight |
| Descricao | description |
| Pass | pass_description |
| Fail | fail_description |
| Not Found | not_found_description |
| Recomendacao | recommendation |
| Risco Tecnico | technical_risk |
| Impacto Negocio | business_impact |
| Endpoint | api_endpoint |
| Logica (step_id) | evaluation_logic.step_id |
| Logica (field) | evaluation_logic.field |
| Logica (operator) | evaluation_logic.operator |
| Logica (value) | evaluation_logic.value |

#### Sheet 2 — Blueprint (collection_steps)
O blueprint ativo "External Domain DNS Scan" possui **20 steps** de coleta. Cada linha tera:

| Coluna | Campo |
|--------|-------|
| Step ID | id |
| Tipo | type |
| Executor | executor |
| Runtime | runtime (se aplicavel) |
| Phase | phase |
| Priority | priority |
| URL Template | config.url_template |
| Response Parser | config.response_parser |
| Query Type | config.query_type |
| Requer API Key | config.requires_api_key |
| Opcional | config.optional |

#### Sheet 3 — Evidence Parses (26 parses ativos)
| Coluna | Campo |
|--------|-------|
| Campo Origem | source_field |
| Label Exibido | display_label |
| Tipo Parse | parse_type |
| Ordem | display_order |
| Oculto | is_hidden |
| Transformacoes | value_transformations (JSON) |

#### Sheet 4 — Guia de Correcoes (rule_correction_guides)
| Coluna | Campo |
|--------|-------|
| Codigo Regra | (join com compliance_rules.code) |
| Titulo Amigavel | friendly_title |
| O que e | what_is |
| Por que importa | why_matters |
| Dificuldade | difficulty |
| Tempo Estimado | time_estimate |
| Passos de Correcao | how_to_fix (lista) |
| Impactos | impacts (lista) |
| Exemplos de Provedor | provider_examples (lista) |

#### Sheet 5 — Fluxo de Analise (resumo)
Documentacao do fluxo completo:
- Trigger: `trigger-external-domain-analysis` (edge function)
- Coleta DNS: agente Python (dns_query executor) + edge functions (subdomain_api)
- Processamento: `agent-task-result` (edge function) — avaliacao de regras, geracao de evidencias, score
- Subdominios: enumeracao server-side via edge function apos coleta do agente
- WHOIS: coletado pelo agente, extraido no `agent-task-result`
- Visualizacao: `ExternalDomainAnalysisReportPage`, `ExternalDomainCompliancePage`
- PDF: `ExternalDomainPDF`
- Categorias visuais: hardcoded em `useCategoryConfig.ts` (sem tabela `category_configs` para external_domain)

### Implementacao

Script Python usando `openpyxl` que:
1. Consulta o banco via `psql` para regras, blueprint steps, parses e guias
2. Gera um XLSX com 5 sheets formatadas
3. Salva em `/mnt/documents/iscope_template_dominio_externo.xlsx`

### Formato

XLSX com sheets nomeadas, headers em negrito, colunas auto-dimensionadas, encoding UTF-8.

