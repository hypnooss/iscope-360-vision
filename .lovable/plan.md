

# Incluir sincronizacao de CVEs na automacao agendada

## Problema

A function `run-scheduled-analyses` processa agendamentos de Firewall, Dominio Externo e Analyzer, mas nao inclui a sincronizacao de CVEs (`refresh-cve-cache`). Isso significa que as fontes de CVE so sao atualizadas manualmente.

## Solucao

Adicionar uma chamada ao `refresh-cve-cache` no final da function `run-scheduled-analyses`, sincronizando todas as fontes ativas automaticamente.

## Detalhes tecnicos

### Arquivo: `supabase/functions/run-scheduled-analyses/index.ts`

Adicionar um novo bloco apos os Analyzer Schedules (antes do retorno final):

```typescript
// ========================================================
// CVE Cache Refresh
// ========================================================
try {
  console.log('[run-scheduled-analyses] Triggering CVE cache refresh...');
  const cveRefreshUrl = `${supabaseUrl}/functions/v1/refresh-cve-cache`;
  const cveRes = await fetch(cveRefreshUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({}),
  });
  const cveResult = await cveRes.json();
  console.log(`[run-scheduled-analyses] CVE refresh: ${cveResult.success ? 'success' : 'failed'}`);
} catch (err) {
  console.error('[run-scheduled-analyses] CVE refresh error:', err);
}
```

Tambem incluir o resultado de CVE no response JSON para visibilidade.

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/run-scheduled-analyses/index.ts` | Adicionar chamada ao refresh-cve-cache |

