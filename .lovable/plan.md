
# Melhorias no Analyzer Dashboard: Auth Sucesso/Falha, Bandeiras, Mapa de Ataques e Log de Config Changes

## Resumo

Quatro melhorias principais no modulo Analyzer:

1. **Separar autenticacao por sucesso e falha** nos widgets de Top IPs e Top Paises (com abas)
2. **Bandeiras de paises** usando a lib `flag-icons` (ja instalada) com mapeamento de nome para codigo ISO
3. **Mapa de ataques** interativo mostrando origens geograficas das conexoes
4. **Pagina de log de alteracoes de configuracao** com detalhes de usuario, acao, objeto e path

---

## Mudancas

### 1. Edge Function `firewall-analyzer/index.ts` - Separar sucesso e falha

Atualmente `analyzeAuthentication` coleta apenas falhas. Precisamos tambem coletar sucessos para gerar rankings separados.

- Adicionar `isSuccess` (complemento de `isFailure`)
- Gerar metricas adicionais:
  - `topAuthIPsSuccess` / `topAuthIPsFailed`
  - `topAuthCountriesSuccess` / `topAuthCountriesFailed`
  - `firewallAuthSuccesses`, `vpnSuccesses`
- Manter os totais existentes para compatibilidade
- Salvar `configChangeDetails` nas metricas: array com `{ user, action, cfgpath, cfgobj, cfgattr, msg, date }` para cada alteracao real, permitindo consulta no frontend

### 2. Tipos `src/types/analyzerInsights.ts` - Novos campos

Adicionar ao `AnalyzerMetrics`:
- `topAuthIPsSuccess`, `topAuthIPsFailed` (arrays de `TopBlockedIP`)
- `topAuthCountriesSuccess`, `topAuthCountriesFailed` (arrays de `TopCountry`)
- `firewallAuthSuccesses`, `vpnSuccesses` (numeros)
- `configChangeDetails` (array de `ConfigChangeDetail`)

Nova interface:
```text
interface ConfigChangeDetail {
  user: string;
  action: string;
  cfgpath: string;
  cfgobj: string;
  cfgattr: string;
  msg: string;
  date: string;
  category: string;
  severity: string;
}
```

### 3. Hook `src/hooks/useAnalyzerData.ts` - Parse novos campos

Atualizar `parseSnapshot` com defaults para todos os novos campos.

### 4. Utilitario `src/lib/countryUtils.ts` - Mapeamento de paises

Criar mapeamento de nomes de paises (como vem do FortiGate: "Netherlands", "Russian Federation", "Slovenia") para codigos ISO 2 letras (`nl`, `ru`, `si`), cobrindo os ~50 paises mais comuns em logs de firewall.

Funcao: `getCountryFlag(countryName: string): string | null` retorna o codigo ISO ou null.

### 5. Dashboard `AnalyzerDashboardPage.tsx` - Refatorar widgets

**Top IPs e Top Paises de Autenticacao:**
- Adicionar abas (Tabs) "Falhas" / "Sucessos" em cada widget
- Tab "Falhas" mostra `topAuthIPsFailed` e `topAuthCountriesFailed`
- Tab "Sucessos" mostra `topAuthIPsSuccess` e `topAuthCountriesSuccess`

**Bandeiras nos widgets de Paises:**
- Importar `flag-icons/css/flag-icons.min.css`
- Ao lado do nome do pais, renderizar `<span className="fi fi-{code}" />` usando o utilitario `getCountryFlag`
- Aplicar tanto nos widgets de Trafego Negado quanto Autenticacao

**Botao "Mapa de Ataques":**
- Adicionar toggle/botao no header da secao de Top IPs/Paises
- Ao clicar, exibe um componente de mapa mundial SVG simplificado com pontos/circulos posicionados por coordenadas aproximadas de cada pais
- Usar um SVG world map inline (sem dependencia externa) com marcadores proporcionais ao volume de eventos
- O mapa mostrara tanto trafego negado quanto autenticacao com cores distintas

**Card "Alteracoes Config" clicavel:**
- No Resumo de Eventos, o card "Alteracoes Config" ganha um botao/link "Ver detalhes"
- Navega para `/scope-firewall/analyzer/config-changes`

### 6. Nova pagina `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

Pagina dedicada para consultar alteracoes de configuracao:

- Breadcrumb: Firewall > Analyzer > Alteracoes de Configuracao
- Seletor de firewall (mesmo padrao)
- Tabela com colunas: Data/Hora, Usuario, Acao, Categoria, Path, Objeto, Atributo, Mensagem, Severidade
- Dados vem de `snapshot.metrics.configChangeDetails`
- Filtros por usuario e por categoria
- Badge de severidade colorido

### 7. Componente `src/components/firewall/AttackMap.tsx` - Mapa de ataques

Componente SVG world map com:
- Mapa base mundial em SVG (paths simplificados dos continentes)
- Circulos/pontos posicionados por coordenadas aproximadas do pais
- Tamanho proporcional ao volume de eventos
- Cores: vermelho para trafego negado, laranja para falhas de auth, verde para sucessos
- Tooltip ao hover mostrando pais + contagem
- Legenda

### 8. Rota no `App.tsx`

Adicionar:
```text
<Route path="/scope-firewall/analyzer/config-changes" element={<AnalyzerConfigChangesPage />} />
```

---

## Secao tecnica

### Separacao de sucesso/falha no edge function

```text
analyzeAuthentication(authLogs, vpnLogs):
  // Falhas (ja existe)
  firewallFailures = safeAuth.filter(isFailure)
  vpnOnlyFailures = safeVpn.filter(isFailure)
  
  // Sucessos (novo)
  isSuccess = (l) => !isFailure(l) && (action includes 'success' || 'allow' || 'accept')
  firewallSuccesses = safeAuth.filter(isSuccess)
  vpnSuccesses = safeVpn.filter(isSuccess)
  
  // Gerar tops separados para failed e success
  topAuthIPsFailed = collectAndRank([...firewallFailures, ...vpnOnlyFailures])
  topAuthIPsSuccess = collectAndRank([...firewallSuccesses, ...vpnSuccesses])
  topAuthCountriesFailed = collectCountryRank([...firewallFailures, ...vpnOnlyFailures])
  topAuthCountriesSuccess = collectCountryRank([...firewallSuccesses, ...vpnSuccesses])
```

### Config change details no edge function

```text
analyzeConfigChanges(logs):
  // Alem dos insights, gerar array de detalhes
  const details = realChanges.map(log => ({
    user: log.user || log.ui || 'unknown',
    action: log.action || '',
    cfgpath: log.cfgpath || '',
    cfgobj: log.cfgobj || '',
    cfgattr: log.cfgattr || '',
    msg: log.msg || log.logdesc || '',
    date: log.date || log.eventtime || '',
    category: cfgpath ? categorizeCfgPath(cfgpath).category : 'Outros',
    severity: cfgpath ? categorizeCfgPath(cfgpath).severity : 'low',
  }));
  
  metrics.configChangeDetails = details.slice(0, 200);
```

### Mapeamento de paises (countryUtils.ts)

```text
const COUNTRY_CODES: Record<string, string> = {
  'netherlands': 'nl',
  'russian federation': 'ru',
  'slovenia': 'si',
  'united states': 'us',
  'china': 'cn',
  'brazil': 'br',
  'germany': 'de',
  'france': 'fr',
  // ... ~50 paises mais comuns
};

// Coordenadas aproximadas para o mapa
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'us': [39, -98],
  'cn': [35, 104],
  'ru': [61, 105],
  'br': [-14, -51],
  // ...
};
```

### Mapa SVG (AttackMap.tsx)

Componente que:
1. Recebe arrays de topCountries (denied + auth failed + auth success)
2. Renderiza SVG com world map paths
3. Posiciona circulos nas coordenadas de cada pais
4. Circulos com raio proporcional ao log(count)
5. Cores distintas por tipo de evento
6. Animacao pulse nos circulos para efeito visual

### Arquivos a criar/editar

- **Criar**: `src/lib/countryUtils.ts` (mapeamento nomes -> codigos ISO + coordenadas)
- **Criar**: `src/components/firewall/AttackMap.tsx` (mapa SVG)
- **Criar**: `src/pages/firewall/AnalyzerConfigChangesPage.tsx` (pagina de log de config changes)
- **Editar**: `supabase/functions/firewall-analyzer/index.ts` (separar sucesso/falha, config details)
- **Editar**: `src/types/analyzerInsights.ts` (novos campos)
- **Editar**: `src/hooks/useAnalyzerData.ts` (parse novos campos)
- **Editar**: `src/pages/firewall/AnalyzerDashboardPage.tsx` (abas, bandeiras, mapa, link config)
- **Editar**: `src/App.tsx` (nova rota)
