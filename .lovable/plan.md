
# Agendamento Diario do Attack Surface Analyzer

## Contexto

Atualmente o Attack Surface Analyzer so pode ser disparado manualmente. Vamos criar uma tabela de agendamento dedicada e integra-la ao scheduler existente (`run-scheduled-analyses`), seguindo o mesmo padrao das tabelas `analysis_schedules`, `external_domain_schedules` e `analyzer_schedules`.

## Horario

- 12:00 UTC-3 = **15:00 UTC** (scheduled_hour = 15)

## Workspaces

| Workspace | client_id |
|---|---|
| PRECISIO | 62842720-92b9-42c9-ae91-16cdaad9284d |
| TASCHIBRA | c5e3878a-0395-4952-b055-277893f66e95 |
| NEXTA | 57fabbc4-6bf8-442e-9948-240a7e44cc2d |
| MOVECTA | 80e94e71-1cc4-402c-b718-e021f5e81cb2 |
| BRINQUEDOS ESTRELA | 145988e9-14b5-49ca-b1e6-c9184cba86f0 |
| IE MADEIRA | 794942aa-05c3-49d5-bd57-4563081c76a2 |

## Mudancas

### 1. Nova tabela: `attack_surface_schedules`

Seguindo o padrao das demais tabelas de agendamento:

```text
Colunas:
  id              uuid (PK, default gen_random_uuid())
  client_id       uuid (NOT NULL, FK -> clients)
  frequency       schedule_frequency (NOT NULL, default 'daily')
  scheduled_hour  integer (default 15)
  scheduled_day_of_week   integer (default 1)
  scheduled_day_of_month  integer (default 1)
  is_active       boolean (default true)
  next_run_at     timestamptz
  created_by      uuid
  created_at      timestamptz (default now())
  updated_at      timestamptz (default now())
```

RLS: Super admins podem gerenciar tudo. Workspace admins podem ver/gerenciar agendamentos dos seus workspaces via `has_client_access`.

### 2. Inserir os 6 agendamentos

Inserir registros para cada workspace com `frequency = 'daily'`, `scheduled_hour = 15`, `is_active = true` e `next_run_at` calculado para a proxima ocorrencia.

### 3. Atualizar `run-scheduled-analyses` Edge Function

Adicionar um novo bloco (seguindo o padrao existente de firewalls/domains/analyzers) que:

1. Busca agendamentos vencidos em `attack_surface_schedules`
2. Para cada agendamento, chama `run-attack-surface-queue` passando `{ client_id }`
3. Calcula o proximo `next_run_at` e atualiza o registro

### 4. Nenhuma mudanca na UI

A pagina de Schedules (`/schedules`) ja consolida agendamentos. Futuramente pode-se adicionar o tipo "Attack Surface" ao painel unificado, mas isso nao e necessario agora — os agendamentos serao executados automaticamente pelo CRON existente.
