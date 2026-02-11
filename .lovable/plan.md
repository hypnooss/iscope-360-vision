

# Migrar CVESection para usar o cache centralizado

## Problema

O componente `CVESection.tsx`, usado no dashboard de analise de firewall individual (`Dashboard.tsx`), ainda chama a Edge Function `fortigate-cve` em tempo real. Todos os outros pontos do sistema ja foram migrados para ler do cache `cve_cache`.

## Solucao

Refatorar `CVESection.tsx` para buscar CVEs da tabela `cve_cache` filtradas por versao de firmware, em vez de invocar a Edge Function.

## Arquivo a modificar

| Arquivo | Alteracao |
|---|---|
| `src/components/CVESection.tsx` | Substituir chamada a `supabase.functions.invoke('fortigate-cve')` por query a `cve_cache` filtrando por `module_code = 'firewall'` e versao no campo `products` |

## Detalhes tecnicos

A logica atual:
```text
supabase.functions.invoke('fortigate-cve', { body: { version } })
```

Sera substituida por:
```text
supabase.from('cve_cache')
  .select('*')
  .eq('module_code', 'firewall')
  .order('score', { ascending: false, nullsFirst: false })
```

Apos o fetch, filtrar no lado cliente as CVEs cujo campo `products` (jsonb array) contenha a versao do firmware passada como prop. Os campos retornados da tabela `cve_cache` serao mapeados para o tipo `CVEInfo` existente:

- `cve_id` -> `id`
- `severity` -> `severity`
- `score` -> `score`
- `description` -> `description`
- `published_date` -> `publishedDate`
- `advisory_url` -> `references[0]`
- `title` -> `affectedVersions`

A migracao e transparente para o componente pai `Dashboard.tsx`, que continua passando `firmwareVersion` e recebendo o callback `onCVEsLoaded`.

Nenhuma alteracao no banco de dados necessaria.

