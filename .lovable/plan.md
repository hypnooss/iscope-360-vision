

## Plano Revisado: Sistema de Fila de Jobs da API (api_jobs)

### Problema

O fluxo completo via API precisa primeiro **cadastrar o domínio** no iScope antes de rodar compliance, analyzer e envio de email. Sem uma fila, não há como encadear essas etapas nem rastrear o progresso.

### Estrutura do banco (nova migration)

**Tabela `api_jobs`**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| api_key_id | uuid FK | Key que originou |
| client_id | uuid FK | Workspace |
| domain_id | uuid FK nullable | Domínio alvo (null até step register concluir) |
| job_type | text | `full_pipeline`, `analysis_only`, etc. |
| status | text | `queued`, `running`, `completed`, `failed`, `partial` |
| steps | jsonb | Array ordenado de steps |
| current_step | text | Step em execução |
| metadata | jsonb | email destino, webhook URL, domain name original |
| error_message | text | |
| created_at, started_at, completed_at, expires_at | timestamptz | |

**RLS**: super_admin leitura, service_role insert/update.

### Steps do Pipeline (ordem corrigida)

```text
Step 1: register     → Cadastra domínio no workspace (POST external_domains)
Step 2: compliance   → Roda análise de compliance (trigger-external-domain-analysis)
Step 3: analyzer     → Análise avançada (depende compliance concluído)
Step 4: email_report → Envia relatório por email (depende analyzer concluído)
```

Estrutura do campo `steps` (jsonb):
```json
[
  { "name": "register", "status": "completed", "result": { "domain_id": "uuid" } },
  { "name": "compliance", "status": "running", "depends_on": "register" },
  { "name": "analyzer", "status": "pending", "depends_on": "compliance" },
  { "name": "email_report", "status": "pending", "depends_on": "analyzer", "params": { "to": "x@y.com" } }
]
```

### Endpoint novo no api-gateway

**`POST /v1/pipeline`** — Cria job com pipeline completo

```json
{
  "domain": "example.com",
  "agent_id": "uuid-opcional",
  "steps": ["register", "compliance", "analyzer", "email_report"],
  "email_to": "relatorio@cliente.com"
}
```

Resposta 202:
```json
{
  "job_id": "uuid",
  "status": "queued",
  "steps": ["register", "compliance", "analyzer", "email_report"]
}
```

- Se o domínio já existe no workspace, step `register` completa imediatamente com o `domain_id` existente (sem duplicar)
- Se `steps` omitido, assume pipeline completo: `["register", "compliance"]`

**`GET /v1/jobs/:id`** — Consulta status do job com detalhe de cada step

Novo scope: `external_domain:pipeline`

### Edge Function: `process-api-jobs`

Processadora da fila (cron a cada 1 minuto):

1. Busca jobs `queued` ou `running` com step pendente cujo `depends_on` esteja `completed`
2. Executa step:
   - **`register`**: Insere domínio em `external_domains` (ou reusa existente). Salva `domain_id` no job e no result do step
   - **`compliance`**: Chama `trigger-external-domain-analysis` com o `domain_id`
   - **`analyzer`**: Chamada futura (placeholder por ora)
   - **`email_report`**: Chamada futura (placeholder por ora)
3. Atualiza status do step → `completed` ou `failed`
4. Se step falha → job `failed`; se todos completos → job `completed`

### Frontend: Alterações

| Arquivo | Mudança |
|---------|---------|
| `ApiAccessManagement.tsx` | Seção "Jobs/Pipeline" com tabela de jobs recentes, status por step (badges coloridos), doc curl atualizada |
| `ApiKeyScopesSelect.tsx` | Scope `external_domain:pipeline` |

### Fluxo completo

```text
Cliente externo                      iScope
     |                                 |
     |  POST /v1/pipeline              |
     |  { domain: "example.com",       |
     |    steps: [register, compliance, |
     |      analyzer, email_report],   |
     |    email_to: "x@y.com" }        |
     |------------------------------->  |
     |                                  | → Insere api_jobs (queued)
     |  202 { job_id, status }          |
     |<-------------------------------  |
     |                                  |
     |                          [process-api-jobs cron]
     |                                  | → Step 1: register
     |                                  |   → Insere external_domains
     |                                  |   → domain_id salvo no job
     |                                  |   → Step completed
     |                                  |
     |                                  | → Step 2: compliance
     |                                  |   → trigger-external-domain-analysis
     |                                  |   → Aguarda conclusão
     |                                  |   → Step completed
     |                                  |
     |                                  | → Step 3: analyzer
     |                                  |   → (depende compliance)
     |                                  |   → Step completed
     |                                  |
     |                                  | → Step 4: email_report
     |                                  |   → Envia PDF por email
     |                                  |   → Job completed
     |                                  |
     |  GET /v1/jobs/:job_id            |
     |------------------------------->  |
     |  { status: completed, steps }    |
     |<-------------------------------  |
```

### Arquivos

| Arquivo | Tipo |
|---------|------|
| Migration SQL | Tabela `api_jobs` + índices + RLS |
| `supabase/functions/process-api-jobs/index.ts` | Novo — processadora da fila |
| `supabase/functions/api-gateway/index.ts` | Rotas `/pipeline` e `/jobs/:id` |
| `src/components/admin/ApiAccessManagement.tsx` | Seção de jobs + doc |
| `src/components/admin/ApiKeyScopesSelect.tsx` | Scope pipeline |

### Ordem de implementação

1. Migration: tabela `api_jobs` + RLS
2. Rotas no `api-gateway`: `POST /v1/pipeline` + `GET /v1/jobs/:id`
3. Edge function `process-api-jobs` (com cron)
4. Frontend: seção de jobs + scope novo

