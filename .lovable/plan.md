

## Problema: Storage SharePoint com valor alocado absurdo

### Diagnóstico

Os dados no snapshot da Precisio mostram:
- `storageUsedGB: 1363.94` → **1.33 TB** ✅ (correto, bate com o print real)
- `storageAllocatedGB: 4,876,164` → **~4.6 PB** ❌ (absurdo)

**Causa raiz**: O CSV do relatório `getSharePointSiteUsageDetail` retorna `Storage Allocated (Byte)` **por site**. Cada site SharePoint tem uma quota padrão de ~25 TB. O código soma as quotas de **todos os 172 sites**, resultando em ~4.8 PB — um número sem significado real.

A quota real do tenant (1.41 TB) vem da API de administração do SharePoint (`/admin/sharepoint/settings`), que não está disponível via `getSharePointSiteUsageDetail`.

### Solução

**1. Backend — Obter quota real do tenant via Graph API** (`collaboration-dashboard/index.ts`)

Usar o endpoint `https://graph.microsoft.com/v1.0/reports/getSharePointSiteUsageStorage(period='D7')` que retorna o consumo agregado diário do tenant. Porém, ele também não retorna a quota total.

A alternativa mais confiável é o endpoint **SharePoint Admin**:
`https://{tenant-domain}-admin.sharepoint.com/_api/StorageQuota`

Como esse endpoint requer escopo SPO admin separado, a solução pragmática é:

- **Usar `getSharePointSiteUsageQuota`** (via Graph beta) se disponível
- **Fallback**: calcular `storageAllocatedGB` como o **MÁXIMO** entre os valores de `Storage Allocated (Byte)` dos sites (que representa a quota do tenant-level), em vez de somar
- **Alternativa final**: usar `admin.sharepoint.com` REST API com o tenant domain

A abordagem mais robusta e imediata: **usar o endpoint `reports/getSharePointSiteUsageStorage(period='D7')`** que retorna storage diário agregado, e complementar com o endpoint `/admin/sharepoint/settings` via REST para obter a quota tenant-level.

**Implementação prática** (sem dependência de permissões extras):

No `collaboration-dashboard/index.ts`:
- Manter a soma de `Storage Used (Byte)` (está correta)
- Para `storageAllocatedGB`: tentar buscar a quota real via `https://{domain}-admin.sharepoint.com/_api/StorageQuota` com o mesmo access token
- Se falhar (sem permissão SPO admin), **não somar as quotas por site**. Em vez disso, definir `storageAllocatedGB = 0` e ajustar a UI para tratar esse caso

**2. Frontend — UI resiliente para quota indisponível** (`TeamsAnalyzerStatsCards.tsx`)

Quando `storageAllocatedGB` for 0 ou absurdamente alto (> storageUsedGB * 100), exibir apenas o storage usado sem barra de progresso enganosa:
- Mostrar `1363.9 GB` ou `1.33 TB` (converter automaticamente se > 1024 GB)
- Esconder a barra de progresso e o "% utilizado" quando a quota não é confiável

**3. Formatação inteligente de unidades**

Converter automaticamente GB → TB quando o valor exceder 1024 GB para melhor legibilidade (1363.9 GB → 1.33 TB).

### Arquivos alterados
- `supabase/functions/collaboration-dashboard/index.ts` — corrigir cálculo de `storageAllocatedGB`, tentar SPO admin API
- `src/components/m365/teams/TeamsAnalyzerStatsCards.tsx` — formatação TB/GB, tratamento de quota indisponível
- `src/components/m365/collaboration/SharePointCards.tsx` — mesma lógica de formatação se exibir storage

