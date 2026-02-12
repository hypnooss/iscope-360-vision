
# Correcao: Dados Duplicados entre Login Firewall e VPN

## Diagnostico

A investigacao revelou que os dados de autenticacao estao **duplicados**. Ambos os steps do blueprint (`auth_events` e `vpn_events`) retornaram exatamente os mesmos 500 registros do FortiGate. Isso acontece porque a API do FortiGate esta retornando o mesmo buffer de log de memoria para ambas as consultas.

**Evidencia concreta:**
- `auth_events`: 46 system + 416 vpn + 37 wireless = 500 registros
- `vpn_events`: 46 system + 416 vpn + 37 wireless = 500 registros (identicos)
- Resultado: 61 falhas de firewall + 61 falhas de VPN = **mesmos eventos contados duas vezes**
- Por isso os mesmos usuarios (admin, love, umang.singh, etc.) e IPs aparecem em ambos os insights

## Causa Raiz

1. O endpoint da API do FortiGate `/api/v2/log/memory/event/system?filter=logdesc=~auth` retorna um mix de eventos (incluindo VPN e wireless)
2. O endpoint `/api/v2/log/memory/event/vpn` tambem retorna o mesmo mix de eventos
3. O edge function `analyzeAuthentication()` recebe dados identicos nos parametros `authLogs` e `vpnLogs`

## Solucao

### 1. Filtrar por `subtype` no Edge Function (`firewall-analyzer/index.ts`)

Adicionar filtragem por `subtype` no inicio de `analyzeAuthentication()` para separar corretamente os eventos:

```text
// Antes de processar, filtrar por subtype para evitar duplicatas
const realAuthLogs = safeAuth.filter(l => {
  const subtype = (l.subtype || '').toLowerCase();
  const logdesc = (l.logdesc || '').toLowerCase();
  // Eventos de sistema com contexto de autenticacao
  return subtype === 'system' || subtype === 'admin' || 
         logdesc.includes('admin login') || logdesc.includes('authentication');
});

const realVpnLogs = safeVpn.filter(l => {
  const subtype = (l.subtype || '').toLowerCase();
  // Apenas eventos realmente de VPN
  return subtype === 'vpn' || subtype === 'ipsec' || subtype === 'ssl';
});
```

Em seguida, usar `realAuthLogs` no lugar de `safeAuth` e `realVpnLogs` no lugar de `safeVpn` em todo o resto da funcao.

### 2. Deduplicacao por ID de log

Como protecao adicional contra dados identicos vindos de ambos os steps, adicionar deduplicacao baseada no campo `id` ou `eventid` do log:

```text
// Coletar IDs ja vistos para evitar contar o mesmo evento duas vezes
const seenIds = new Set<string>();
const dedup = (logs: any[]) => logs.filter(l => {
  const logId = l.id || l.eventid || `${l.date}_${l.time}_${l.srcip}_${l.user}`;
  if (seenIds.has(logId)) return false;
  seenIds.add(logId);
  return true;
});
```

### 3. Melhorar as queries do Blueprint (banco de dados)

Atualizar os paths da API no blueprint "FortiGate - Analyzer" para filtros mais especificos:

- **auth_events**: `/api/v2/log/memory/event/system?filter=logdesc=~"Admin login"&rows=500`
  (filtrar especificamente por "Admin login" em vez de apenas "auth")
- **vpn_events**: `/api/v2/log/memory/event/vpn?filter=subtype==vpn&rows=500`
  (adicionar filtro de subtype)

Esta alteracao sera feita via UPDATE no banco de dados.

## Arquivos a editar

- **Editar**: `supabase/functions/firewall-analyzer/index.ts` - Adicionar filtragem por subtype e deduplicacao na funcao `analyzeAuthentication()`
- **Reimplantar**: Edge function `firewall-analyzer`
- **SQL**: Atualizar filtros do blueprint no banco de dados

## Impacto

Apos a correcao:
- Os contadores de "Login Firewall" e "Falhas VPN" mostrarao valores reais e distintos
- Os insights de brute force serao separados corretamente (se houver brute force em ambos, sera por dados diferentes)
- Os rankings de Top IPs/Paises refletirao origens distintas para cada tipo de evento
- O usuario precisara **re-executar a analise** para gerar dados corretos
