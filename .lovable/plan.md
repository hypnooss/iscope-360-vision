

# Resetar Sync da Fonte History para Recomecar com Cursor de Data

## Problema

A sync inicial (537 CVEs) foi feita com offset numerico, sem ordenacao por data. A API NVD retornou CVEs de 1997 a 2026 de forma nao-sequencial. O cursor atual (`2025-09-29`) pula qualquer CVE antiga que a API nao tenha retornado nos primeiros 537 resultados.

## Solucao

Resetar a fonte History para recomecar do zero com a logica de cursor por data. Isso garante varredura cronologica completa.

### Passos

1. **Limpar CVEs existentes da fonte History** no `cve_cache`
2. **Resetar o estado da fonte**: limpar `sync_cursor_date`, `last_sync_at`, `last_sync_count`
3. **Garantir que `fetchAllNvdPages` ordena por data de publicacao** (parametro `pubStartDate` na API NVD ja faz isso naturalmente)

### Execucao

Uma unica migracao SQL:

```sql
-- Limpar CVEs da fonte History
DELETE FROM cve_cache
WHERE source_id = (SELECT id FROM cve_sources WHERE source_label = 'History');

-- Resetar estado da fonte
UPDATE cve_sources
SET
  config = config - 'sync_cursor_date' - 'sync_offset',
  last_sync_at = NULL,
  last_sync_count = 0,
  last_sync_status = 'pending',
  last_sync_error = NULL
WHERE source_label = 'History';
```

Apos isso, ao clicar "Sincronizar", a fonte vai:
1. Buscar as 500 CVEs mais antigas (sem filtro de data)
2. Salvar cursor = data da CVE mais recente do lote
3. Continuar de onde parou a cada clique

### Consideracao sobre a Fonte Node.js

A mesma situacao pode afetar a fonte Node.js (518 CVEs). Recomendo resetar tambem:

```sql
DELETE FROM cve_cache
WHERE source_id = (SELECT id FROM cve_sources WHERE source_label = 'Node.js');

UPDATE cve_sources
SET
  config = config - 'sync_cursor_date' - 'sync_offset',
  last_sync_at = NULL,
  last_sync_count = 0,
  last_sync_status = 'pending',
  last_sync_error = NULL
WHERE source_label = 'Node.js';
```

### Verificacao Importante na Edge Function

Preciso confirmar que a API NVD retorna resultados ordenados por `published_date` quando usamos o endpoint sem filtro de data. Se nao, sera necessario adicionar um parametro de ordenacao na chamada da API.

## Arquivos Modificados

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Reset das fontes History e Node.js |
| `supabase/functions/refresh-cve-cache/index.ts` | Verificar/garantir ordenacao por data na chamada da API NVD |

