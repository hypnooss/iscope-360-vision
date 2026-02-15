
# Limite de CVEs por Invocacao (Sync Paginado)

## Problema

Ao adicionar um novo produto com milhares de CVEs (ex: 5000), o sync inicial tenta baixar tudo numa unica execucao, causando timeout. O sync diferencial so funciona apos o primeiro sync completo.

## Solucao

Adicionar um limite maximo de CVEs por invocacao (ex: 500) na funcao `fetchAllNvdPages`. Quando o limite e atingido, o sync para e salva o progresso parcial. Na proxima execucao agendada, o sync diferencial busca apenas CVEs modificadas apos o ultimo save -- progressivamente preenchendo o cache.

### Arquivo: `supabase/functions/refresh-cve-cache/index.ts`

### 1. Novo parametro `maxResults` em `fetchAllNvdPages`

Adicionar um limite opcional. Quando o total de CVEs acumulados atingir esse limite, parar a paginacao e retornar o que ja foi coletado.

```text
Antes (linha 141):
  while (startIndex < totalResults) { ... }

Depois:
  const limit = options?.maxResults ?? Infinity;
  while (startIndex < totalResults && allVulnerabilities.length < limit) { ... }
```

Ao final, logar se o sync foi parcial:
```text
if (allVulnerabilities.length < totalResults) {
  console.log(`  [NVD] Partial sync: fetched ${allVulnerabilities.length} of ${totalResults}`);
}
```

### 2. Passar `maxResults` nas funcoes de sync

Tanto `syncNistNvdSource` quanto `syncNistNvdWebSource` passarao `maxResults: 500` para `fetchAllNvdPages`. Isso vale para TODOS os syncs (full e diferencial), garantindo protecao em ambos os cenarios.

### 3. Marcar sync parcial como "success" com flag

O sync parcial ainda salva `last_sync_status: 'success'` e atualiza `last_sync_at`, para que a proxima execucao use a data como filtro diferencial. Assim, a cada rodada do cron, o sistema busca as proximas CVEs que ainda nao foram cacheadas.

### 4. Indicar sync parcial no log e no `last_sync_error`

Quando o sync for parcial, gravar uma mensagem informativa no campo `last_sync_error`:
```text
"Sync parcial: 500 de 5000 CVEs processadas nesta rodada"
```
Isso da visibilidade ao admin sem impedir o fluxo normal.

## Fluxo para Produto Novo com 5000 CVEs

```text
Rodada 1: Full sync -> busca paginas 0-499 (500 CVEs) -> salva -> last_sync_at = agora
Rodada 2: Diferencial desde rodada 1 -> busca 0-500 novas/modificadas -> salva
Rodada 3: Diferencial desde rodada 2 -> busca 0-500 novas/modificadas -> salva
...
Rodada N: Diferencial retorna < 500 -> cache completo
```

## Resumo das Mudancas

| Local | Mudanca |
|-------|---------|
| `fetchAllNvdPages` (L110-183) | Novo parametro `maxResults` com default 500, para paginacao quando limite e atingido |
| `syncNistNvdSource` (L206) | Passar `maxResults: 500` |
| `syncNistNvdWebSource` (L284) | Passar `maxResults: 500` |
| Main handler (L564-569) | Gravar mensagem informativa quando sync for parcial |
