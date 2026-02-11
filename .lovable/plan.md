

# Corrigir performance: usar cache para top CVEs no Dashboard

## Problema

O hook `useTopCVEs` chama `useFirewallCVEs()` e `useM365CVEs()` que fazem requisicoes HTTP em tempo real ao NIST NVD e MSRC. Isso leva 10+ segundos e trava o dashboard. O cron job `refresh-cve-cache` ja roda diariamente e popula `cve_severity_cache`, mas essa tabela so guarda contagens por severidade, nao os CVEs individuais.

## Solucao

### 1. Adicionar coluna `top_cves` na tabela `cve_severity_cache`

Nova coluna JSONB para armazenar os 2 CVEs de maior score:

```sql
ALTER TABLE cve_severity_cache 
ADD COLUMN top_cves jsonb DEFAULT '[]'::jsonb;
```

Formato:
```json
[
  {"id": "CVE-2024-21762", "score": 9.8, "severity": "CRITICAL"},
  {"id": "CVE-2024-23113", "score": 9.1, "severity": "CRITICAL"}
]
```

### 2. Atualizar edge function `refresh-cve-cache`

Nas funcoes `refreshFirewallCVEs` e `refreshM365CVEs`, apos calcular as contagens, ordenar os CVEs por score e guardar os top 2 na nova coluna `top_cves` ao fazer o upsert.

### 3. Reescrever `useTopCVEs.ts`

Em vez de chamar `useFirewallCVEs` e `useM365CVEs` (que fazem HTTP externo), o hook fara uma unica query leve ao Supabase:

```typescript
const { data } = useQuery({
  queryKey: ['top-cves-cache', clientId],
  queryFn: () => supabase
    .from('cve_severity_cache')
    .select('module_code, top_cves')
    .or(`client_id.eq.${clientId},client_id.is.null`)
});
```

Isso retorna instantaneamente os top CVEs do cache local, sem nenhuma chamada externa.

### 4. Remover dependencias pesadas

O `useTopCVEs` nao importara mais `useFirewallCVEs` nem `useM365CVEs`, eliminando as chamadas HTTP ao NIST/MSRC no dashboard.

## Arquivos

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Adicionar coluna `top_cves` a `cve_severity_cache` |
| `supabase/functions/refresh-cve-cache/index.ts` | Salvar top 2 CVEs no upsert |
| `src/hooks/useTopCVEs.ts` | Reescrever para ler do cache via Supabase query |
| `src/pages/GeneralDashboardPage.tsx` | Ajustar desestruturacao do retorno se necessario |

