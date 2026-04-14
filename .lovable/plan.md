

## Plano — Visualizador de Logs dos Jobs/Pipeline

### Resumo

Criar um componente `PipelineJobDetail` (Sheet/Dialog) que abre ao clicar num botão "Ver Detalhes" na linha do job, mostrando timeline dos steps com status, timestamps, duração, resultados e erros.

### Alterações

**1. Novo componente `src/components/admin/PipelineJobDetail.tsx`**

- Sheet lateral que recebe o objeto `ApiJob` completo
- Header: domínio, tipo, status geral, erro (se houver)
- Timeline vertical dos steps:
  - Ícone por status (CheckCircle verde, XCircle vermelho, Loader azul, Clock cinza)
  - Nome do step, status, timestamps (`started_at`, `completed_at`), duração calculada
  - Se step tem `result` (ex: `domain_id`, `analysis_id`, `snapshot_id`, `score`), mostrar em badges/mono
  - Se step tem `error`, mostrar em bloco vermelho
- Seção metadata: `email_to`, `agent_id`, `domain`, `job_id`

**2. Atualizar `src/components/admin/ApiAccessManagement.tsx`**

- Adicionar state `selectedJob: ApiJob | null`
- Na coluna Ações, adicionar botão com ícone `Eye` (lucide) para todos os jobs
- Ao clicar, seta `selectedJob` e abre o `PipelineJobDetail`
- Import do `Eye` do lucide-react

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/admin/PipelineJobDetail.tsx` | Novo |
| `src/components/admin/ApiAccessManagement.tsx` | Atualizar — botão ver detalhes + state |

