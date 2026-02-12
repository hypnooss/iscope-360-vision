
# Melhorias no Analyzer: Metricas Precisas e Separacao de Autenticacao

## Problemas Identificados

1. **Alteracoes de Config = 200 falso**: O blueprint coleta ate 200 linhas do FortiGate (`rows=200`) e o analyzer conta `logs.length` como total. Resultado: sempre mostra 200 mesmo que as alteracoes reais sejam menos (o filtro `logdesc=~config` retorna qualquer log de sistema que mencione "config", incluindo leituras/consultas que nao sao alteracoes).

2. **Falhas VPN misturadas**: A funcao `analyzeAuthentication` junta `auth_events` + `vpn_events` em um unico array e conta tudo como `vpnFailures`. Nao ha distincao entre tentativas de login no painel do firewall vs tentativas de VPN SSL/IPsec.

3. **Top Paises e IPs incompletos**: Atualmente os tops vem apenas do trafego negado (`denied_traffic`). Falhas de autenticacao e VPN tambem contem IPs e paises que deveriam alimentar esses rankings.

## Mudancas Propostas

### 1. Edge Function `firewall-analyzer/index.ts` - Separar autenticacao

**Funcao `analyzeAuthentication`:**
- Separar a analise em dois grupos: falhas de login no firewall (`auth_events`) e falhas de VPN (`vpn_events`)
- Criar metricas distintas:
  - `firewallAuthFailures`: total de falhas de login no painel administrativo
  - `vpnFailures`: total de falhas de VPN (SSL + IPsec)
- Gerar insights separados para cada tipo:
  - "Falhas de Login no Firewall" (categoria `authentication`)
  - "Falhas de VPN" (categoria `authentication`) com indicacao do tipo (SSL/IPsec quando possivel via campo `tunneltype` ou `logdesc`)
- Extrair top IPs e paises de ambas as fontes de autenticacao

**Funcao `analyzeConfigChanges`:**
- Filtrar logs que sao realmente alteracoes de configuracao (acoes `Add`, `Edit`, `Delete`, `Set`) vs simples consultas ou leituras
- Contar apenas logs com `action` contendo keywords de modificacao, ignorando reads/queries
- A metrica `configChanges` refletira o numero real de alteracoes

**Metricas combinadas de Top IPs / Top Paises:**
- Criar dois novos arrays nas metricas: `topAuthIPs` e `topAuthCountries`
- Combinar IPs/paises de auth failures + vpn failures para enriquecer os rankings

### 2. Blueprint de coleta (via banco)

- Alterar o step `config_changes` para filtrar apenas acoes de modificacao:
  - Path atual: `/api/v2/log/memory/event/system?filter=logdesc=~config&rows=200`
  - Novo path: `/api/v2/log/memory/event/system?filter=logdesc=~"changed"&rows=500`
  - Ou, alternativamente, manter o filtro atual e aplicar o filtro de acao no processamento (mais seguro, pois depende da versao do FortiOS)

Decisao: manter o filtro atual no blueprint e filtrar no processamento para manter compatibilidade. Aumentar `rows` para 500.

### 3. Tipos TypeScript `src/types/analyzerInsights.ts`

Atualizar `AnalyzerMetrics`:
```text
interface AnalyzerMetrics {
  topBlockedIPs: TopBlockedIP[];
  topCountries: TopCountry[];
  vpnFailures: number;
  firewallAuthFailures: number;    // NOVO
  topAuthIPs: TopBlockedIP[];       // NOVO - IPs de falhas auth/vpn
  topAuthCountries: TopCountry[];   // NOVO - Paises de falhas auth/vpn
  ipsEvents: number;
  configChanges: number;
  totalDenied: number;
  totalEvents: number;
}
```

### 4. Dashboard `AnalyzerDashboardPage.tsx`

- Substituir o card "Falhas VPN" unico por dois cards: "Login Firewall" e "Falhas VPN"
- Adicionar um novo widget "Top IPs - Autenticacao" (ou integrar ao widget existente com abas)
- Adicionar "Top Paises - Autenticacao" ao widget existente ou como widget separado
- Manter compatibilidade com snapshots antigos (fallback para `vpnFailures` quando `firewallAuthFailures` nao existir)

### 5. Hook `useAnalyzerData.ts`

- Atualizar `parseSnapshot` para incluir os novos campos `firewallAuthFailures`, `topAuthIPs`, `topAuthCountries` com defaults vazios

## Secao Tecnica

### Logica de separacao de autenticacao no `firewall-analyzer`

```text
function analyzeAuthentication(authLogs, vpnLogs):
  
  // 1. Processar authLogs (login no firewall admin)
  firewallFailures = authLogs.filter(log => action has deny/fail)
  
  // 2. Processar vpnLogs (VPN SSL/IPsec)  
  vpnOnlyFailures = vpnLogs.filter(log => action has deny/fail)
  
  // 3. Gerar insights separados
  if firewallFailures >= threshold:
    insight "Alto Volume de Falhas de Login no Firewall"
  
  if vpnOnlyFailures >= threshold:
    insight "Alto Volume de Falhas de VPN"
    - detalhar tipo (SSL/IPsec) quando campo tunneltype disponivel
  
  // 4. Brute force por usuario (manter, mas indicar origem)
  - agrupar por fonte (firewall vs vpn)
  
  // 5. Extrair top IPs e paises de ambos
  return {
    insights,
    metrics: {
      firewallAuthFailures: firewallFailures.length,
      vpnFailures: vpnOnlyFailures.length,
      topAuthIPs: [...],
      topAuthCountries: [...]
    }
  }
```

### Logica de filtragem de config changes

```text
function analyzeConfigChanges(logs):
  // Filtrar apenas acoes de modificacao real
  const MODIFY_ACTIONS = ['Add', 'Edit', 'Delete', 'Set', 'Move'];
  const realChanges = logs.filter(log => {
    const action = log.action || '';
    return MODIFY_ACTIONS.some(a => action.toLowerCase().includes(a.toLowerCase()));
  });
  
  // Usar realChanges.length como configChanges (nao logs.length)
  return { metrics: { configChanges: realChanges.length } };
```

### Atualizacao do blueprint (via SQL update)

```text
UPDATE device_blueprints SET collection_steps = jsonb_set(...)
WHERE name = 'FortiGate - Analyzer'
  -- Alterar config_changes step: rows de 200 para 500
```

### Arquivos a criar/editar

- **Editar**: `supabase/functions/firewall-analyzer/index.ts` (separar auth, filtrar config)
- **Editar**: `src/types/analyzerInsights.ts` (novos campos)
- **Editar**: `src/hooks/useAnalyzerData.ts` (parse novos campos)
- **Editar**: `src/pages/firewall/AnalyzerDashboardPage.tsx` (novos widgets/cards)
- **SQL update**: blueprint `FortiGate - Analyzer` (rows 200 -> 500 no step config_changes)
