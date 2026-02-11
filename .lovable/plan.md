

# Agendamento de Firewalls: Tela de Edição + Schedule Funcional

## Problema

1. O modal de edição de firewall é pequeno e limitado -- precisa virar uma tela dedicada
2. A tabela `analysis_schedules` armazena apenas a frequência (`daily`, `weekly`, `monthly`), sem informações de horário, dia da semana ou dia do mês
3. Não existe nenhum cron job que dispare as análises agendadas -- o schedule é salvo mas nunca executado

## Solução

### Parte 1: Tela de Edição (substituir modal)

Criar uma nova rota `/scope-firewall/firewalls/:id/edit` com uma página dedicada (`FirewallEditPage.tsx`) que exibe o formulário completo de edição do firewall, incluindo os novos campos de agendamento.

- O botão de edição (lápis) na lista passa a navegar para essa rota em vez de abrir o modal
- A tela terá layout com Card, breadcrumb, e botão Voltar
- O `EditFirewallDialog.tsx` será removido

### Parte 2: Campos de agendamento detalhado

Quando o usuário selecionar a frequência:

| Frequência | Campos adicionais |
|---|---|
| Manual | Nenhum |
| Diário | Horário (select com opções de 00:00 a 23:00) |
| Semanal | Dia da semana (seg-dom) + Horário |
| Mensal | Dia do mês (1-28) + Horário |

### Parte 3: Schema do banco de dados (migration)

Adicionar 3 colunas à tabela `analysis_schedules`:

```text
scheduled_hour   INTEGER (0-23)     -- horário da execução
scheduled_day_of_week INTEGER (0-6) -- 0=domingo, 6=sábado (para weekly)
scheduled_day_of_month INTEGER (1-28) -- dia do mês (para monthly)
```

Atualizar `next_run_at` automaticamente ao salvar, calculando a próxima data/hora de execução com base na frequência e nos novos campos.

### Parte 4: Edge Function de scheduler (`run-scheduled-analyses`)

Criar uma nova edge function que:

1. Consulta `analysis_schedules` onde `is_active = true` e `next_run_at <= NOW()`
2. Para cada schedule encontrado, chama `trigger-firewall-analysis` para criar a task
3. Atualiza `next_run_at` para a próxima execução com base na frequência/horário
4. Registra logs de sucesso/erro

### Parte 5: Cron job (pg_cron)

Criar um cron job que executa a cada **15 minutos** chamando a edge function `run-scheduled-analyses`. Isso garante que as análises serão disparadas com precisão razoável (no máximo 15 min de atraso).

```text
*/15 * * * * -> POST /functions/v1/run-scheduled-analyses
```

## Detalhes técnicos

### Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/pages/firewall/FirewallEditPage.tsx` | Tela de edição com formulário completo e campos de schedule |
| `supabase/functions/run-scheduled-analyses/index.ts` | Edge function que dispara análises agendadas |

### Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `src/App.tsx` | Adicionar rota `/scope-firewall/firewalls/:id/edit` |
| `src/pages/firewall/FirewallListPage.tsx` | Botão de editar navega para a nova rota; remover referências ao EditFirewallDialog |
| `supabase/config.toml` | Adicionar config da nova edge function |

### Arquivos removidos

| Arquivo | Motivo |
|---|---|
| `src/components/firewall/EditFirewallDialog.tsx` | Substituído pela tela dedicada |

### Migration SQL

1. `ALTER TABLE analysis_schedules ADD COLUMN scheduled_hour INTEGER DEFAULT 0`
2. `ALTER TABLE analysis_schedules ADD COLUMN scheduled_day_of_week INTEGER DEFAULT 1`  
3. `ALTER TABLE analysis_schedules ADD COLUMN scheduled_day_of_month INTEGER DEFAULT 1`
4. Update dos registros existentes (daily) para `scheduled_hour = 2` (executar às 2h da manhã por padrão)
5. Calcular e preencher `next_run_at` para todos os schedules existentes

### Cron job (INSERT via SQL, não migration)

Criar cron job via insert tool para chamar `run-scheduled-analyses` a cada 15 minutos.

### Lógica de cálculo do `next_run_at`

A edge function `run-scheduled-analyses` calcula a próxima execução:

- **Diário**: próximo dia no horário configurado
- **Semanal**: próximo dia da semana configurado no horário configurado
- **Mensal**: próximo mês no dia e horário configurados

### Fluxo do agendamento

```text
pg_cron (a cada 15min)
  -> POST run-scheduled-analyses
    -> SELECT schedules WHERE next_run_at <= NOW()
    -> Para cada schedule:
       -> POST trigger-firewall-analysis (firewall_id)
       -> UPDATE next_run_at = próxima execução
```

