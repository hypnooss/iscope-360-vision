
# Adicionar Suporte a Dominios Externos no Scheduler Automatico

## Problema

A Edge Function `run-scheduled-analyses` consulta apenas a tabela `analysis_schedules` (firewalls) e chama `trigger-firewall-analysis`. A tabela `external_domain_schedules` nunca e verificada, por isso os agendamentos de dominios externos ficam marcados como "Atrasado" e nenhuma execucao e criada.

## Solucao

Adicionar uma segunda etapa na mesma Edge Function para tambem consultar e processar agendamentos de dominios externos.

## Alteracoes

### Arquivo: `supabase/functions/run-scheduled-analyses/index.ts`

Apos o loop dos firewalls, adicionar:

1. **Query em `external_domain_schedules`** buscando agendamentos ativos, nao-manuais e com `next_run_at <= NOW()`
2. **Loop para cada agendamento vencido**:
   - Chamar `trigger-external-domain-analysis` com `{ domain_id: schedule.domain_id }`
   - Tratar 409 como sucesso (analise ja em andamento)
   - Calcular e atualizar `next_run_at` usando a mesma funcao `calculateNextRunAt` ja existente
3. **Somar os contadores** (`triggered`, `errors`) com os resultados de ambas as etapas
4. **Atualizar a resposta** para incluir detalhes de ambos os tipos no log e no JSON de retorno

## Resultado esperado

Quando o cron job invocar `run-scheduled-analyses` a cada 15 minutos, ele agora verificara ambas as tabelas e disparara analises tanto para firewalls quanto para dominios externos automaticamente.

Nenhuma migracao de banco necessaria. Nenhum arquivo frontend alterado.
