

## Plano: Detecção de React/JS Frameworks + CVEs React2Shell

### Problema Identificado

O host `sgi.ourosafra.com.br:443` retorna status **307** (redirect) e o httpx não seguiu o redirect, resultando em `technologies: []`. Mesmo seguindo, o `-tech-detect` do httpx (Wappalyzer) tem limitações com SPAs React porque não executa JavaScript — React só é visível analisando o HTML/body da resposta.

### Mudanças Propostas

#### 1. Melhorar coleta no httpx (`python-agent/agent/executors/httpx_executor.py`)

- Adicionar flags `-follow-redirects` e `-include-response` (ou `-response-in-json`) para que o httpx siga redirects e capture o body HTML
- No `_parse_output`, extrair o body e aplicar **fingerprinting de JS frameworks** via regex:
  - `__NEXT_DATA__` → Next.js/React
  - `data-reactroot`, `__react`, `_reactRoot` → React
  - `ng-app`, `ng-version` → Angular
  - `__NUXT__`, `__nuxt` → Nuxt/Vue
  - `id="__vue"`, `data-v-` → Vue.js
  - `svelte` → Svelte
- Injetar as detecções no array `technologies` do serviço web

#### 2. Adicionar regra de tech obsoleta (`src/lib/surfaceFindings.ts`)

Adicionar ao `OBSOLETE_TECH_RULES` uma entrada para React < 18 (versões com vulnerabilidades conhecidas, incluindo React2Shell):

```typescript
{
  pattern: /react[\/:]?(15\.|16\.|17\.)/i,
  severity: 'high',
  name: 'React desatualizado detectado',
  eolInfo: 'React 16/17 possuem vulnerabilidades conhecidas incluindo React2Shell (CVE-2025-29927)',
  technicalRisk: 'Versões antigas do React podem permitir Server-Side Request Forgery e execução remota via React2Shell.',
  businessImpact: 'Aplicação web vulnerável a ataques que podem resultar em acesso não autorizado ao servidor.',
  recommendation: 'Atualizar para React 18+ e Next.js 15+ (se aplicável).',
}
```

#### 3. Adicionar fonte de CVEs para React (`cve_sources`)

Criar uma nova fonte via a UI de "Gerenciar Fontes" ou inserir diretamente:
- **source_label**: `React / Next.js`
- **source_type**: `nist_nvd_web`
- **module_code**: `external_domain`
- **config**: `{ "product_filter": "react" }`

E outra para Next.js:
- **source_label**: `Next.js`
- **config**: `{ "product_filter": "next.js" }`

#### 4. Exibir tecnologias detectadas no painel do ativo

No `AssetDetailSheet.tsx`, na aba **Serviços**, mostrar as tecnologias detectadas por web service (já existe `technologies` no dado, mas verificar se está sendo renderizado).

### Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| `python-agent/agent/executors/httpx_executor.py` | Adicionar `-follow-redirects`, fingerprinting de body HTML |
| `src/lib/surfaceFindings.ts` | Nova regra React/Next.js no `OBSOLETE_TECH_RULES` |
| `src/components/surface/AssetDetailSheet.tsx` | Verificar/adicionar exibição de technologies |
| BD: `cve_sources` | Inserir fontes React e Next.js |

