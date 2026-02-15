
# Sync Diferencial de CVEs

## Problema Atual

Toda sincronizacao busca o historico completo de CVEs no NVD (sem filtro de data), resultando em centenas de paginas, alto consumo de tempo e risco de timeout -- mesmo com o fix de 1 fonte por vez.

## Solucao: Sync Diferencial

Usar o campo `last_sync_at` da fonte para limitar a busca apenas a CVEs **publicadas ou modificadas** desde a ultima sincronizacao bem-sucedida. Na primeira execucao (quando `last_sync_at` e null), faz o sync completo normalmente.

### Arquivo: `supabase/functions/refresh-cve-cache/index.ts`

### 1. Adicionar parametro `lastModStartDate` ao `fetchAllNvdPages`

A API NVD v2.0 suporta os parametros `lastModStartDate` e `lastModEndDate` que filtram por data de modificacao (inclui CVEs novas e atualizadas). Isso e melhor que `pubStartDate` porque tambem captura CVEs antigas que tiveram score ou severidade atualizados.

```text
Novo parametro em options:
  lastModStartDate?: string  (ISO date)

Se fornecido, adiciona ao URL:
  lastModStartDate = <valor>
  lastModEndDate = <agora>
```

**Importante**: O NVD nao permite combinar `keywordSearch` com `lastModStartDate` se o range for maior que 120 dias. Para ranges curtos (syncs frequentes), isso nao sera problema.

### 2. Passar `last_sync_at` da fonte para as funcoes de sync

As funcoes `syncNistNvdSource` e `syncNistNvdWebSource` receberao a data do ultimo sync bem-sucedido. Se existir, usam como `lastModStartDate`; se nao (primeira vez), fazem sync completo.

```text
// No main handler, ao chamar as funcoes:
counts = await syncNistNvdSource(supabase, source, source.last_sync_at);
counts = await syncNistNvdWebSource(supabase, source, source.last_sync_at);
```

### 3. Logica dentro de cada funcao de sync

```text
Se last_sync_at existe:
  -> fetchAllNvdPages(keyword, { lastModStartDate: last_sync_at })
  -> Busca apenas CVEs modificadas desde o ultimo sync
  -> Upsert no cache (atualiza existentes, insere novas)
  -> Contar total REAL do cache apos upsert (SELECT COUNT)

Se last_sync_at e null:
  -> Sync completo (comportamento atual)
```

### 4. Recontar o total apos sync diferencial

Como o sync diferencial so traz CVEs novas/modificadas, o `counts.total` retornado nao reflete o total real no cache. Apos o upsert, fazer um `SELECT count(*)` filtrado por `source_id` para obter o numero correto de `last_sync_count`.

### 5. MSRC (M365) -- ja e diferencial

A funcao `syncMsrcSource` ja usa filtro por meses configurado. Nao precisa de mudanca.

## Resumo das Mudancas

| Local | Mudanca |
|-------|---------|
| `fetchAllNvdPages` | Novo parametro `lastModStartDate` para filtrar por data de modificacao |
| `syncNistNvdSource` | Receber `last_sync_at`, usar como filtro diferencial |
| `syncNistNvdWebSource` | Receber `last_sync_at`, usar como filtro diferencial |
| Main handler | Passar `source.last_sync_at` para as funcoes de sync |
| Main handler | Recontar total real do cache apos sync diferencial |

## Beneficio Esperado

- Sync inicial completo: ~5-10 paginas por fonte (mantido)
- Syncs subsequentes: 1-2 paginas por fonte (apenas CVEs novas nos ultimos dias)
- Tempo de execucao cai de ~60s para ~10-15s por fonte
