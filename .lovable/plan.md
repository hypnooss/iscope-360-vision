
# Fix: Converter CPEs para formato 2.3 no refresh-cve-cache

## Problema

A sincronizacao da fonte "NIST NVD - Servicos Web" executou com sucesso mas retornou **0 CVEs**. Os logs confirmam que todos os 12 CPEs detectados estao no formato antigo v2.2 (`cpe:/a:apache:http_server:2.4.37`) e a API do NVD v2.0 retorna 404 para todos. A API exige o formato CPE 2.3 (`cpe:2.3:a:apache:http_server:2.4.37:*:*:*:*:*:*:*`).

O badge "X CVEs" nao aparece no dialog porque `last_sync_count` e 0 -- isso e correto e sera resolvido automaticamente quando CVEs forem de fato sincronizados.

## Solucao

Adicionar uma funcao `normalizeCpe23()` no `refresh-cve-cache/index.ts` que converte CPEs v2.2 para v2.3 antes de enviar ao NVD.

### Arquivo: `supabase/functions/refresh-cve-cache/index.ts`

**1. Adicionar funcao auxiliar** (junto das funcoes utilitarias no topo):

```typescript
function normalizeCpe23(cpe: string): string {
  if (cpe.startsWith('cpe:2.3:')) return cpe;
  if (cpe.startsWith('cpe:/')) {
    const raw = cpe.slice(5);
    const parts = raw.split(':');
    while (parts.length < 11) parts.push('*');
    return 'cpe:2.3:' + parts.join(':');
  }
  return cpe;
}
```

**2. Aplicar a conversao** na funcao `syncNistNvdWebSource`, ao montar a URL do NVD:

```typescript
// Antes
nvdUrl.searchParams.set('cpeName', cpe);

// Depois  
const cpe23 = normalizeCpe23(cpe);
nvdUrl.searchParams.set('cpeName', cpe23);
```

Apos o deploy, basta clicar em "Sincronizar" novamente na fonte "NIST NVD - Servicos Web" e os CVEs devem ser baixados e populados corretamente na tabela e no badge de contagem.
