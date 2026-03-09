

# Fix: Rankings de Autenticação vazios e contagem incorreta

## Causa Raiz Confirmada

A investigação dos dados brutos revelou **dois problemas distintos**:

### Problema 1: Logs não-autenticação sendo contados como autenticação

O blueprint `auth_events` busca **todos** os eventos do tipo `subtype==system`:
```
/api/v2/log/memory/event/system?filter=subtype==system&rows=500
```

Isso retorna DHCP, SNMP, perf-stats, threat feeds, etc. A função `isSuccess`/`isFailure` é genérica demais:

- **SAO-FW**: 95 logs retornados, ~12 são "Threat feed updated **successfully**" → contados como auth success (falso positivo)
- **USINA-FW**: ~182 logs de "SNMP query **failed**" → contados como auth failure (falso positivo — com srcip, por isso aparecem nos rankings)
- **BAU-FW**: retorna apenas logs de login real (logid `0100032002`) → funciona corretamente

### Problema 2: IP extraído só de `srcip`

Para os logs de login que realmente existem, o IP de origem está em `srcip` (e redundantemente em `ui` como `"https(10.0.0.1)"`). Este campo existe tanto em success quanto failure, mas o problema principal é o filtro acima — sem logs de login real, não há IPs para extrair.

## Evidência nos dados

| Firewall | auth_events contém | Resultado |
|---|---|---|
| BAU-FW | Apenas logid 0100032002 (login fail) | Rankings OK para falhas |
| SAO-FW | DHCP, threat feeds, perf-stats | 12 "auth success" falsos, 0 IPs |
| USINA-FW | SNMP failures, DHCP, perf-stats | 182 "auth fail" falsos (SNMP) |
| BR-CPS-FW-001 | Mix de tudo | Falhas OK (login real), success falso |

## Solução

**Arquivo**: `supabase/functions/firewall-analyzer/index.ts`

### Mudança 1: Pré-filtrar logs de autenticação real

Antes de passar `authData` para `analyzeAuthentication`, filtrar para incluir apenas logs de **admin login** real:

```typescript
// Filter raw auth to actual admin login events only
const AUTH_LOGIDS = new Set(['0100032001', '0100032002', '0100032003']);
const filterAuthLogs = (logs: any[]) => logs.filter(l => {
  // Match by logid (most reliable)
  if (l.logid && AUTH_LOGIDS.has(l.logid)) return true;
  // Match by action=login (fallback for versions that don't have standard logid)
  if ((l.action || '').toLowerCase() === 'login') return true;
  // Match by logdesc containing "Admin login" 
  if ((l.logdesc || '').toLowerCase().includes('admin login')) return true;
  return false;
});
```

Aplicar este filtro onde `authData` é construído (linha ~1365), antes de passar para `analyzeAuthentication`.

### Mudança 2: Fallback de IP via campo `ui`

Em `collectRankings`, adicionar fallback para extrair IP do campo `ui` (formato `"https(1.2.3.4)"` ou `"ssh(1.2.3.4)"`):

```typescript
const extractIpFromUi = (ui: string): string | null => {
  const match = ui?.match(/\(([^)]+)\)/);
  return match?.[1] || null;
};

const ip = log.srcip || log.remip || log.src || extractIpFromUi(log.ui);
```

### Arquivos alterados
- `supabase/functions/firewall-analyzer/index.ts` — adicionar filtro de logid/action em authData e fallback de IP via `ui`

Após o deploy, as próximas snapshots já terão dados corretos. As snapshots existentes não serão afetadas (dados históricos com contagem errada).

