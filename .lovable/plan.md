

# Adicionar Coluna "Proxima Execucao" na Tabela de CVEs

## Contexto

A secao "Sincronizacao de CVEs" na pagina de Agendamentos nao exibe quando sera a proxima execucao. Diferente dos outros agendamentos (Firewalls, Dominios, etc.), as fontes de CVE nao possuem o campo `next_run_at` no banco de dados.

## Plano

### 1. Migracao SQL: Adicionar coluna `next_run_at` em `cve_sources`

```text
ALTER TABLE cve_sources 
ADD COLUMN next_run_at timestamptz;
```

### 2. Edge Function `refresh-cve-cache`: Computar `next_run_at` apos cada sync

No update final de cada fonte (linha ~586), adicionar o calculo de `next_run_at`. Como o cron de `run-scheduled-analyses` roda a cada hora, o proximo sync sera em ~1 hora:

```text
next_run_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
```

Isso sera adicionado tanto no path de sucesso quanto no de erro, garantindo que a coluna sempre reflita a proxima tentativa.

### 3. UI: Adicionar coluna na tabela de CVEs

No arquivo `src/pages/admin/SchedulesPage.tsx`, adicionar:

- Nova `TableHead` "Proxima Execucao" entre "Ultimo Sync" e "CVEs"
- Nova `TableCell` usando a mesma funcao `renderNextRun` ja existente na pagina, mantendo consistencia visual com as outras tabelas de agendamento

### Detalhes Tecnicos

| Local | Mudanca |
|-------|---------|
| Migracao SQL | Adicionar coluna `next_run_at` em `cve_sources` |
| `refresh-cve-cache/index.ts` (L586-591) | Incluir `next_run_at` no update de sucesso |
| `refresh-cve-cache/index.ts` (L596-599) | Incluir `next_run_at` no update de erro |
| `SchedulesPage.tsx` (L627-631) | Adicionar header "Proxima Execucao" |
| `SchedulesPage.tsx` (L661-665) | Adicionar celula com `renderNextRun(source.next_run_at)` |

