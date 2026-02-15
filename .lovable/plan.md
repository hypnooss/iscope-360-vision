
# Remover Filtro `months` de Todas as Fontes de CVE

## Contexto

Tres fontes possuem o campo `months` no JSON `config`, limitando a busca inicial de CVEs:

- **FortiGate** -- `months: 6`
- **SonicWall** -- `months: 6`
- **Microsoft 365** -- `months: 3`

Esse filtro so e usado na **primeira sincronizacao** (quando `last_sync_at` e NULL). Como todas as fontes ja foram sincronizadas ao menos uma vez, o filtro nao tem efeito pratico hoje. Porem, se por algum motivo o `last_sync_at` for limpo para forcar uma re-sincronizacao completa, o filtro voltaria a restringir os resultados.

## Alteracoes

### 1. Banco de Dados -- Remover `months` do `config`

Atualizar as 3 fontes para remover a chave `months` do JSONB `config`:

```text
-- FortiGate: {"months": 6, "vendor": "fortinet"} -> {"vendor": "fortinet"}
UPDATE cve_sources SET config = config - 'months' WHERE id = '91a2fc5c-...';

-- SonicWall: {"months": 6, "vendor": "sonicwall"} -> {"vendor": "sonicwall"}
UPDATE cve_sources SET config = config - 'months' WHERE id = '4c36f29e-...';

-- Microsoft 365: {"months": 3} -> {}
UPDATE cve_sources SET config = config - 'months' WHERE id = 'a7123478-...';
```

### 2. Edge Function `refresh-cve-cache` -- Remover logica de `months`

Tres pontos no codigo precisam ser ajustados:

**a) `fetchAllNvdPages` (linha ~132):** Remover o bloco `else if (options?.months)` que aplica filtro por `pubStartDate`/`pubEndDate`. Sem esse bloco, syncs iniciais buscam todos os CVEs disponiveis (limitado pelo `maxResults: 500` por execucao com paginacao automatica).

**b) `syncFirewallSource` (linha ~210):** Remover a leitura de `months` do config e parar de passá-lo para `fetchAllNvdPages`.

**c) `syncExternalDomainSource` (linha ~289):** Idem -- remover leitura de `months`.

**d) `syncMsrcSource` (linha ~355):** Atualmente usa `months || 3` como fallback fixo para chamar a Edge Function `m365-cves`. Remover a leitura do config e usar um valor fixo padrao (12 meses) para garantir cobertura ampla na API MSRC.

### 3. Forcar re-sincronizacao completa (opcional)

Para importar CVEs historicas que ficaram de fora, limpar `last_sync_at` das 3 fontes afetadas:

```text
UPDATE cve_sources
SET last_sync_at = NULL, last_sync_status = 'pending'
WHERE id IN ('91a2fc5c-...', '4c36f29e-...', 'a7123478-...');
```

Isso fara com que a proxima execucao do cron realize uma sincronizacao completa (sem filtro de data), trazendo todo o historico disponivel.

## Resumo de Arquivos Modificados

| Arquivo | Tipo de Mudanca |
|---|---|
| `supabase/functions/refresh-cve-cache/index.ts` | Remover logica de `months` em 4 pontos |
| Banco de dados (migration) | Remover `months` do config + limpar `last_sync_at` |

## Resultado Esperado

Todas as fontes passarao a buscar CVEs sem restricao temporal na primeira sincronizacao, garantindo cobertura completa do historico de vulnerabilidades.
