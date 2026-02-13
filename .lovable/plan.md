

# Analyzer: Web Filter, App Control e Fix de Top Paises

## Resumo

Duas entregas:

1. **Bug Fix**: Top Paises - Autenticacao vazio no BR-PMP-FW-001 porque os logs de `event/system` do FortiGate nao incluem `srccountry`. Solucao: cruzar IPs de autenticacao com o mapeamento IP-pais do trafego negado (que tem `srccountry`).

2. **Nova Feature**: Coletar e exibir rankings de categorias de Web Filter bloqueadas, aplicacoes bloqueadas e ranking de User/IP (priorizando user, fallback para IP).

---

## 1. Bug Fix - Top Paises Autenticacao

**Causa raiz**: O endpoint `/api/v2/log/memory/event/system` do FortiGate nao retorna o campo `srccountry` nos logs de autenticacao. O firewall `98640ddd` (outro) retorna, mas o `6c09ae1b` (BR-PMP-FW-001) nao.

**Solucao**: Na funcao `analyzeAuthentication` do edge function `firewall-analyzer`, receber tambem os dados de trafego negado e construir um mapa IP->Pais a partir deles. Usar esse mapa para enriquecer os IPs de autenticacao que nao tem pais.

**Arquivo**: `supabase/functions/firewall-analyzer/index.ts`

- Alterar a assinatura de `analyzeAuthentication` para receber um mapa `ipCountryMap: Record<string, string>` construido a partir do `analyzeDeniedTraffic`.
- Na funcao `collectRankings`, se `log.srccountry` estiver vazio, fazer fallback para o `ipCountryMap[ip]`.
- Construir o `ipCountryMap` no fluxo principal (linhas ~620-624) a partir dos dados de trafego negado antes de chamar `analyzeAuthentication`.

---

## 2. Nova Feature - Web Filter e App Control

### 2a. Blueprint (banco de dados)

Adicionar 2 novos steps ao blueprint "FortiGate - Analyzer" (ID: `9e33ae45-053c-4ea2-9723-c9e0cf01549c`):

| Step ID | Endpoint FortiGate | Descricao |
|---|---|---|
| `webfilter_blocked` | `/api/v2/log/memory/utm/webfilter?filter=action==blocked&rows=500` | Logs de categorias web bloqueadas |
| `appctrl_blocked` | `/api/v2/log/memory/utm/app-ctrl?filter=action==block&rows=500` | Logs de aplicacoes bloqueadas |

### 2b. Edge Function - Novos modulos de analise

**Arquivo**: `supabase/functions/firewall-analyzer/index.ts`

Adicionar duas novas funcoes de analise:

**`analyzeWebFilter(logs)`** - Processa logs de webfilter:
- Agrupa por `catdesc` (categoria) e conta bloqueios
- Gera ranking de top categorias bloqueadas
- Gera ranking de top users/IPs (prioriza `user` do log, fallback para `srcip`)
- Gera insights para categorias de alto risco (malware, phishing, botnet)

**`analyzeAppControl(logs)`** - Processa logs de app-ctrl:
- Agrupa por `app` ou `appcat` (aplicacao/categoria) e conta bloqueios
- Gera ranking de top aplicacoes bloqueadas
- Gera ranking de top users/IPs (mesma logica: user > IP)
- Gera insights para apps de alto risco (P2P, proxy, remote access)

Novas metricas adicionadas ao objeto `metrics`:

```
topWebFilterCategories: { category: string; count: number }[]
topWebFilterUsers: { user: string; ip?: string; count: number }[]
topAppControlApps: { app: string; category?: string; count: number }[]
topAppControlUsers: { user: string; ip?: string; count: number }[]
webFilterBlocked: number
appControlBlocked: number
```

### 2c. Tipos TypeScript

**Arquivo**: `src/types/analyzerInsights.ts`

Adicionar novas interfaces e campos em `AnalyzerMetrics`:

```typescript
export interface TopCategory {
  category: string;
  count: number;
}

export interface TopUserIP {
  user: string;
  ip?: string;
  count: number;
}
```

E adicionar em `AnalyzerMetrics`:
```typescript
topWebFilterCategories: TopCategory[];
topWebFilterUsers: TopUserIP[];
topAppControlApps: TopCategory[];
topAppControlUsers: TopUserIP[];
webFilterBlocked: number;
appControlBlocked: number;
```

### 2d. Hook de dados

**Arquivo**: `src/hooks/useAnalyzerData.ts`

Atualizar `parseSnapshot` para incluir os novos campos de metricas com defaults vazios.

### 2e. Dashboard - Novos widgets

**Arquivo**: `src/pages/firewall/AnalyzerDashboardPage.tsx`

Adicionar 2 novos cards no grid de widgets:

1. **Top Categorias Web Bloqueadas** - Lista com barras proporcionais (mesmo estilo dos widgets existentes), mostrando as categorias web mais bloqueadas.

2. **Top Aplicacoes Bloqueadas** - Lista com barras proporcionais das aplicacoes mais bloqueadas.

Cada card tera abas:
- **Categorias/Apps**: Ranking das categorias ou aplicacoes
- **Usuarios/IPs**: Ranking dos usuarios (ou IPs quando user nao disponivel)

Adicionar tambem ao card "Resumo de Eventos":
- `Web Filter` (total bloqueados)
- `App Control` (total bloqueados)

---

## Arquivos alterados

| Arquivo | Tipo |
|---|---|
| `supabase/functions/firewall-analyzer/index.ts` | Edge function - novos modulos + fix country |
| `src/types/analyzerInsights.ts` | Tipos - novas interfaces |
| `src/hooks/useAnalyzerData.ts` | Hook - novos campos no parser |
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Dashboard - novos widgets |
| Blueprint DB (migration SQL) | Adicionar 2 steps ao blueprint |

## Sequencia de implementacao

1. Migration SQL para atualizar blueprint com novos steps
2. Atualizar tipos TypeScript
3. Atualizar edge function com novos modulos e fix de paises
4. Atualizar hook de dados
5. Atualizar dashboard com novos widgets
6. Deploy da edge function

