# Status: ✅ Implementado

## Fix: Rankings de Autenticação vazios e contagem incorreta

### O que foi feito

1. **Filtro de logs de autenticação real** (`supabase/functions/firewall-analyzer/index.ts`):
   - Pré-filtro por `logid` (`0100032001`, `0100032002`, `0100032003`), `action=login` ou `logdesc` contendo "Admin login"
   - Elimina falsos positivos (DHCP, SNMP, threat feeds, perf-stats) que inflavam contagens

2. **Fallback de IP via campo `ui`** (`supabase/functions/firewall-analyzer/index.ts`):
   - `collectRankings` agora extrai IP do campo `ui` (formato `"https(10.0.0.1)"`) quando `srcip`/`remip`/`src` não existem
   - Mesma lógica aplicada no enriquecimento GeoIP
