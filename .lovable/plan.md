

# Analyzer: Workspace Selector + Fix Paises Autenticacao

## 1. Workspace Selector para Super Admins

Adicionar o mesmo padrao de seletor de workspace usado na FirewallListPage ao AnalyzerDashboardPage. O fluxo sera:

1. Super Admin seleciona o **Workspace** primeiro
2. O seletor de **Firewall** filtra apenas firewalls daquele workspace
3. Dados bloqueados ate workspace estar selecionado

**Arquivo**: `src/pages/firewall/AnalyzerDashboardPage.tsx`

Alteracoes:
- Importar `useEffectiveAuth`, `usePreview`, `useQuery`, `Building2`
- Adicionar estado `selectedWorkspaceId` e query de workspaces (mesmo padrao da FirewallListPage)
- Auto-selecionar primeiro workspace
- Filtrar a query de firewalls por `client_id` do workspace selecionado
- Renderizar o seletor de workspace ANTES do seletor de firewall no header

Layout do header:
```
[Workspace: ACME Corp v] [Firewall: AAX-FW v] [Executar Analise]
```

---

## 2. Fix Paises - Autenticacao

**Diagnostico real**: O ipCountryMap construido a partir do trafego negado nao funciona para este firewall porque:
- O trafego negado e todo interno (10.x.x.x) mapeado como "Reserved"
- Os IPs de autenticacao sao externos e nao aparecem no trafego negado

**Solucao**: Enriquecer o ipCountryMap tambem com os proprios logs de autenticacao que **tem** `srccountry` (alguns logs do mesmo batch podem ter o campo). Alem disso, adicionar um segundo passo: percorrer os logs de VPN que frequentemente contem `srccountry` e usar como fonte adicional.

**Arquivo**: `supabase/functions/firewall-analyzer/index.ts`

No bloco principal (linhas 724-731), apos construir o ipCountryMap do trafego negado, tambem iterar sobre:
- `authData` (logs de autenticacao)
- `vpnData` (logs de VPN)

Extrair `srccountry`/`src_country` de qualquer log que tenha o campo e adicionar ao mapa. Isso garante que mesmo quando o trafego negado nao ajuda, os proprios logs de auth/VPN contribuem quando disponiveis.

```typescript
// Enrich from auth and VPN logs too
for (const log of [...authLogs, ...vpnLogs]) {
  const ip = log.srcip || log.remip || log.src;
  const country = log.srccountry || log.src_country;
  if (ip && country && !ipCountryMap[ip]) ipCountryMap[ip] = country;
}
```

**Nota**: Se o FortiGate em questao (BR-PMP-FW-001) realmente nao retorna `srccountry` em NENHUM tipo de log (nem auth, nem VPN, nem denied), entao a unica solucao seria integrar um servico de geolocalizacao de IP externo (ex: ip-api.com, MaxMind), o que pode ser considerado em uma iteracao futura.

---

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Workspace selector + filtro de firewalls por workspace |
| `supabase/functions/firewall-analyzer/index.ts` | Enriquecer ipCountryMap com logs de auth/VPN |

## Sequencia

1. Atualizar AnalyzerDashboardPage com workspace selector
2. Atualizar edge function para enriquecer ipCountryMap
3. Deploy da edge function

