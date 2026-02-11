

# Corrigir Early Return e Disparar Agendamentos Atrasados

## Problema Raiz

Na Edge Function `run-scheduled-analyses`, linhas 62-68, existe um `return` prematuro: quando nao ha agendamentos de firewall vencidos (`dueSchedules` vazio), a funcao retorna imediatamente com "No schedules due" e **nunca executa a secao de dominios externos** (linhas 121+).

```text
Fluxo atual (BUG):
  Busca firewalls vencidos -> Nenhum encontrado -> RETURN "No schedules due" -> FIM
                                                   (dominios NUNCA verificados)
```

## Correcao

### Arquivo: `supabase/functions/run-scheduled-analyses/index.ts`

Remover o early return das linhas 62-68. Em vez de retornar quando nao ha firewalls, simplesmente pular o loop de firewalls e continuar para a secao de dominios externos.

Substituir:
```
if (!dueSchedules || dueSchedules.length === 0) {
  console.log('No schedules due for execution.');
  return new Response(...);
}
```

Por:
```
if (!dueSchedules || dueSchedules.length === 0) {
  console.log('No firewall schedules due.');
}
```

O resto do codigo ja trata corretamente o caso de `dueSchedules` vazio porque o `for` simplesmente nao executa.

### Apos o deploy

Invocar manualmente a funcao para disparar os 2 agendamentos atrasados (next_run_at = 21:00 UTC).

## Resultado

O cron job passara a verificar **ambas** as tabelas independentemente, sem que uma bloqueie a outra.
