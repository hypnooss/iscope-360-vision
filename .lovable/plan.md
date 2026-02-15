

# Preencher `next_run_at` para Todas as Fontes de CVE

## Situacao Atual

Ja existem 2 cron jobs ativos que garantem a sincronizacao automatica de CVEs:

1. `run-scheduled-analyses` (a cada 15 min) -- chama `refresh-cve-cache` internamente
2. `refresh-cve-cache-daily` (diario as 06:00 UTC) -- chamada direta

Cada invocacao processa 1 fonte (a mais antiga), portanto com ~96 chamadas/dia todas as 12 fontes sao sincronizadas varias vezes ao dia.

## Problema

As fontes mostram "--" na coluna "Proxima Execucao" porque foram sincronizadas antes da coluna `next_run_at` ser criada. O valor esta NULL.

## Solucao

Executar um UPDATE simples para preencher `next_run_at` para todas as fontes que estao com valor NULL, distribuindo as proximas execucoes ao longo da proxima hora:

```text
UPDATE cve_sources
SET next_run_at = NOW() + (ROW_NUMBER() OVER (ORDER BY id) * INTERVAL '5 minutes')
WHERE next_run_at IS NULL;
```

Isso ira preencher a coluna para todas as fontes existentes. A partir dai, a Edge Function `refresh-cve-cache` ja atualiza automaticamente o `next_run_at` a cada sync (sucesso ou erro), inclusive para fontes futuras.

## Resultado Esperado

Todas as 12 fontes passarao a exibir o timestamp da proxima execucao na coluna "Proxima Execucao", eliminando os "--" do painel.

Nenhuma mudanca de codigo e necessaria -- apenas o UPDATE no banco.

