
# Correção de 3 Problemas no Attack Map e Tabelas de Auth

## Diagnóstico dos 3 Problemas

### Problema 1: Direção das setas vermelhas (tráfego negado)
O código atual usa `M${px},${py} L${fw[0]},${fw[1]}` para setas inbound (origem → firewall). O usuário quer que as setas de **tráfego negado** saiam do firewall em direção ao país de origem (indicando que o firewall bloqueou aquele destino/origem). Isso é uma escolha de visualização: firewall → países bloqueados.

A solução é simples: para a camada `denied`, inverter o path para `M${fw[0]},${fw[1]} L${px},${py}` (igual às outbound). Auth failures continuam chegando no firewall (lógica correta).

### Problema 2: Cor laranja não aparece
No `AnalyzerDashboardPage.tsx`, linha 701:
```ts
authFailedCountries={fwAuthCountriesFailed}
```
`fwAuthCountriesFailed` (linha 465) usa fallback para `topAuthCountriesFailed` (combinado FW+VPN) quando `topFwAuthCountriesFailed` está vazio.

E linha 702:
```ts
authFailedVpnCountries={vpnAuthCountriesFailed}
```
`vpnAuthCountriesFailed` = `m?.topVpnAuthCountriesFailed ?? []` — se não separado, é vazio.

**Resultado:** laranja (FW fail) recebe os países combinados, amarelo (VPN fail) fica vazio. Como ambos os arrays têm os mesmos países, o círculo amarelo fica sobreposto ao laranja — visualmente some.

**Causa raiz no backend:** Na `analyzeAuthentication`, o filtro por subtype é:
```ts
safeAuth = rawAuth.filter(l => subtype === 'system' || subtype === 'admin' || logdesc.includes('admin login') || ...)
safeVpn = rawVpn.filter(l => subtype === 'vpn' || subtype === 'ipsec' || subtype === 'ssl')
```
Se os logs `authData` e `vpnData` vêm de collections diferentes no FortiGate mas têm subtypes que não batem exatamente, `safeAuth` ou `safeVpn` pode ficar vazio, fazendo os rankings separados serem idênticos aos combinados.

A solução mais robusta é: **remover o filtro rígido por subtype** e em vez disso classificar os logs pela **collection de origem**: tudo que vem de `authData` é tratado como FW auth, tudo de `vpnData` é VPN — sem filtrar por subtype dentro de cada coleção (já que o agent os coletou de endpoints diferentes).

### Problema 3: Tabelas Auth FW e Auth VPN idênticas
Mesmo resultado da causa raiz acima. Com o filtro por subtype removido e ranking por collection de origem, os dados serão corretamente separados.

---

## Solução

### Arquivo 1: `supabase/functions/firewall-analyzer/index.ts`

**Remover o filtro rígido por subtype** na função `analyzeAuthentication`. Em vez de tentar reclassificar os logs por subtype dentro de cada collection, confiar na separação já feita pelo agente (authData = logs administrativos, vpnData = logs VPN):

```ts
// ANTES: filtros rígidos que descartam logs válidos
const safeAuth = dedup(rawAuth.filter(l => {
  const subtype = (l.subtype || '').toLowerCase();
  return subtype === 'system' || subtype === 'admin' || ...
}));

const safeVpn = dedup(rawVpn.filter(l => {
  const subtype = (l.subtype || '').toLowerCase();
  return subtype === 'vpn' || subtype === 'ipsec' || subtype === 'ssl';
}));

// DEPOIS: deduplicar apenas entre as duas collections, sem filtrar por subtype
const safeAuth = dedup(rawAuth);  // confiar no agente: authData = FW admin logs
const safeVpn = dedup(rawVpn);    // confiar no agente: vpnData = VPN logs
```

Isso garante que todos os logs de autenticação do firewall sejam processados como FW, e todos os logs VPN como VPN.

### Arquivo 2: `src/components/firewall/AttackMap.tsx`

**Separar inboundPoints em dois grupos:**
- `deniedPoints` — usa path invertido (firewall → país): `M${fw} L${p}` 
- `authPoints` — mantém path original (país → firewall): `M${p} L${fw}`

Isso requer refatorar `ProjectileOverlay` para receber os dois grupos separados:

```ts
// Projectile groups separados
interface ProjectileGroup {
  points: { lat; lng; color; label; count; type }[];
  direction: 'inbound' | 'outbound';  // 'outbound' = firewall → destination
}
```

No render:
- denied + outbound: `direction = 'outbound'` (firewall emite o projétil)  
- fw_fail + vpn_fail + auth_success: `direction = 'inbound'` (projétil vem do país)

### Arquivo 3: `src/pages/firewall/AnalyzerDashboardPage.tsx`

**Remover os fallbacks que misturam dados FW e VPN** nas linhas 463-476:

```ts
// ANTES (com fallbacks que cruzam dados):
const fwAuthCountriesFailed = m?.topFwAuthCountriesFailed?.length 
  ? m.topFwAuthCountriesFailed 
  : (m?.topAuthCountriesFailed?.length ? m.topAuthCountriesFailed : m?.topAuthCountries ?? []);

// DEPOIS (sem fallback para dados combinados):
const fwAuthCountriesFailed = m?.topFwAuthCountriesFailed ?? [];
const vpnAuthCountriesFailed = m?.topVpnAuthCountriesFailed ?? [];
```

Para o mapa, usar os dados separados diretamente sem fallback cruzado:
```ts
// Para o mapa: só passar dados realmente separados
authFailedCountries={m?.topFwAuthCountriesFailed ?? []}    // laranja
authFailedVpnCountries={m?.topVpnAuthCountriesFailed ?? []} // amarelo
```

---

## Resumo das mudanças

| Arquivo | Mudança |
|---|---|
| `supabase/functions/firewall-analyzer/index.ts` | Remover filtro por subtype na `analyzeAuthentication` — confiar na separação por collection do agente |
| `src/components/firewall/AttackMap.tsx` | Separar denied (firewall → país) de auth fail (país → firewall) no `ProjectileOverlay` |
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Remover fallbacks que cruzam dados FW/VPN nos rankings e no mapa |

Após as mudanças, a edge function precisa ser **reimplantada** (`firewall-analyzer`). Os dados nos snapshots existentes já têm os campos separados se o filtro não foi muito restritivo — mas o ideal é executar uma nova análise para garantir os rankings limpos.
