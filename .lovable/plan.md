

# Substituir Offset Numerico por Cursor de Data nas Syncs de CVE

## Problema Atual

O sistema usa `sync_offset` (numero) para paginar a API NVD. Porem a API nao garante ordenacao estavel entre chamadas, entao o offset numerico pode resultar em CVEs duplicadas e CVEs perdidas.

## Solucao: Cursor Baseado em Data

Em vez de salvar um offset numerico, o sistema salvara a data da CVE mais recente sincronizada (`sync_cursor_date`). Na proxima execucao, usara essa data como filtro `pubStartDate` para buscar apenas CVEs publicadas a partir dali.

### Logica Nova

```text
1. Sync inicial (last_sync_at = NULL, sem sync_cursor_date):
   - Busca CVEs sem filtro de data (startIndex=0)
   - Limite de 500 CVEs por execucao
   - Ao final: pega a published_date da CVE mais recente do lote
   - Se buscou 500 (parcial): salva sync_cursor_date no config, NAO seta last_sync_at
   - Se buscou < 500 (completo): limpa sync_cursor_date, seta last_sync_at = NOW

2. Sync continuacao (sync_cursor_date existe):
   - Busca CVEs com pubStartDate = sync_cursor_date (startIndex=0)
   - Limite de 500 CVEs por execucao
   - Ao final: pega a published_date da CVE mais recente do lote
   - Se buscou 500 (parcial): atualiza sync_cursor_date
   - Se buscou < 500 (completo): limpa sync_cursor_date, seta last_sync_at = NOW

3. Sync diferencial (last_sync_at != NULL, sem sync_cursor_date):
   - Comportamento atual (busca por lastModStartDate) -- sem mudanca
```

### Fluxo Visual

```text
  Clique "Sincronizar"
         |
   sync_cursor_date existe?
    /              \
  NAO               SIM
   |                 |
  last_sync_at?     Continuacao
  /       \         pubStartDate=cursor
NULL      SET       limit 500
 |         |            |
Full     Diferencial   Buscou 500?
limit500 lastModDate   /       \
 |         |         SIM      NAO
Buscou    Fim         |        |
 500?              Atualiza   Limpa cursor
/    \             cursor     Seta last_sync_at
SIM  NAO
|     |
Salva Seta
cursor last_sync_at
```

## Vantagens sobre Offset Numerico

- Nao depende de ordenacao estavel da API
- O upsert por `cve_id` ja garante que duplicatas sejam ignoradas (idempotente)
- Se a mesma CVE aparecer novamente, e apenas um update sem custo
- Progresso real: cada execucao avanca no tempo, impossivel ficar preso

## Alteracoes no Codigo

### Arquivo: `supabase/functions/refresh-cve-cache/index.ts`

**a) `fetchAllNvdPages`:**

- Remover parametro `startIndex`
- Adicionar parametro `pubStartDate?: string` para filtrar por data de publicacao
- Quando `pubStartDate` e fornecido, setar os parametros `pubStartDate` e `pubEndDate` (now) na URL da API NVD
- Manter `startIndex=0` fixo (sem offset numerico)
- Manter `maxResults` para limitar a 500

**b) `syncNistNvdSource`:**

- Ler `sync_cursor_date` do `source.config` em vez de `sync_offset`
- Se `last_sync_at` e NULL OU `sync_cursor_date` existe: fazer full/continuacao sync
  - Se `sync_cursor_date` existe: passar como `pubStartDate`
  - Se nao: sem filtro de data (primeira vez)
- Apos buscar CVEs: encontrar a `published_date` mais recente do lote
- Se buscou >= 500: setar `isPartial = true` e `newCursorDate = max published_date`
- Se buscou < 500: sync completa

**c) `syncNistNvdWebSource`:**

- Mesma logica do item (b) acima

**d) Handler principal (linhas 578-602):**

- Se `isPartial`: salvar `sync_cursor_date` no config (em vez de `sync_offset`)
- Se completo: limpar `sync_cursor_date` do config (em vez de `sync_offset`)
- Remover qualquer referencia a `sync_offset`

### Sem alteracao no banco de dados

O campo `config` (JSONB) ja suporta `sync_cursor_date` sem migracao.

### Sem alteracao no frontend

O comportamento visivel e identico: o usuario clica "Sincronizar" e ve o contador crescer ate completar.

## Resultado Esperado

| Acao | Comportamento |
|---|---|
| 1a sync | Busca 500 CVEs mais antigas, salva cursor = data da mais recente |
| 2a sync | Busca 500 CVEs a partir do cursor, avanca cursor |
| 3a sync | Busca restante (< 500), limpa cursor, seta last_sync_at |
| Syncs seguintes | Diferencial por lastModStartDate (captura updates) |

## Arquivo Modificado

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/refresh-cve-cache/index.ts` | Substituir logica de offset numerico por cursor de data em 4 pontos |

