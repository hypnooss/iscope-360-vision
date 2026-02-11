
# Administracao > CVEs - Centro de Controle de CVEs da Plataforma

## Visao Geral

Transformar a pagina `/cves` no **ponto central e unico** de gestao de CVEs da plataforma. Hoje os modulos (Firewall e M365) consultam APIs externas em tempo real. A nova arquitetura faz com que **toda CVE usada no sistema venha do cache**, e esta pagina permite visualizar e configurar quais fontes de CVE estao sendo sincronizadas.

## Arquitetura Atual vs Nova

```text
HOJE:
  FirewallCVEsPage --> Edge Function fortigate-cve --> NIST NVD (tempo real)
  M365CVEsPage     --> Edge Function m365-cves     --> MSRC API (tempo real)
  Dashboard        --> cve_severity_cache (apenas contagens agregadas)

NOVO:
  Admin > CVEs (configuracao + visualizacao)
       |
       v
  cve_severity_cache  <-- refresh-cve-cache (cron diario) --> APIs externas
       |
       v
  Todas as paginas do sistema leem APENAS do cache
```

## O que muda

### 1. Nova tabela: `cve_sources` (configuracao de fontes)

Tabela para configurar quais fontes de CVE o sistema deve sincronizar:

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid | PK |
| module_code | text | 'firewall' ou 'm365' |
| source_type | text | 'nist_nvd' ou 'msrc' |
| source_label | text | Nome amigavel (ex: "NIST NVD - FortiOS") |
| config | jsonb | Parametros da fonte (vendor, product, months, etc) |
| is_active | boolean | Se esta fonte esta ativa para sincronizacao |
| last_sync_at | timestamptz | Ultima sincronizacao bem-sucedida |
| last_sync_status | text | 'success', 'error', 'pending' |
| last_sync_error | text | Mensagem de erro da ultima sync |
| last_sync_count | integer | Quantidade de CVEs na ultima sync |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: super_admin pode gerenciar, usuarios autenticados podem visualizar.

### 2. Nova tabela: `cve_cache` (CVEs individuais completas)

Tabela para armazenar cada CVE com todos os seus detalhes:

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid | PK |
| cve_id | text | Ex: CVE-2024-12345 (unique com source_id) |
| source_id | uuid | FK para cve_sources |
| module_code | text | 'firewall' ou 'm365' |
| severity | text | CRITICAL, HIGH, MEDIUM, LOW |
| score | numeric | CVSS score |
| title | text | Titulo da CVE |
| description | text | Descricao completa |
| products | jsonb | Produtos afetados |
| published_date | date | Data de publicacao |
| advisory_url | text | Link para advisory |
| raw_data | jsonb | Dados brutos da API para referencia |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Indice unico em `(cve_id, source_id)`. RLS: usuarios autenticados podem ler, service_role pode gerenciar.

### 3. Pagina `CVEsCachePage.tsx` - Redesign completo

**Header**: Titulo "CVEs" + subtitulo "Central de vulnerabilidades da plataforma" + botoes:
- "Atualizando..." (auto-refresh, ja existe)
- "Configurar Fontes" (abre dialog/pagina de configuracao de fontes)

**Cards de resumo** (5 cards clicaveis para filtrar):
- Total de CVEs no cache
- Criticos
- Altos
- Medios
- Baixos

**Filtros**:
- Busca textual (CVE ID ou descricao)
- Filtro por modulo (Todos / Firewall / M365)
- Filtro por severidade (via StatCards)

**Lista de CVEs**: Cards expandiveis (Collapsible) com:
- Badge de severidade + badge do modulo
- CVE ID clicavel (link NVD/MSRC)
- CVSS Score + titulo
- Produtos afetados
- Data de publicacao
- Ao expandir: descricao completa + links advisory
- Indicador de fonte (qual `cve_source` gerou)

**Fontes ativas**: Secao inferior mostrando status das fontes configuradas (ultima sync, contagem, erros).

### 4. Dialog de Configuracao de Fontes (`CVESourcesConfigDialog.tsx`)

Dialog acessivel pelo botao "Configurar Fontes" com:
- Lista de fontes ativas/inativas
- Botao para adicionar nova fonte
- Para cada fonte:
  - Nome, tipo (NIST NVD / MSRC), modulo
  - Configuracao especifica (vendor, product, months)
  - Toggle ativo/inativo
  - Status da ultima sincronizacao
  - Botao para sincronizar manualmente (chama `refresh-cve-cache`)

### 5. Atualizar Edge Function `refresh-cve-cache`

Modificar para:
- Ler as fontes ativas da tabela `cve_sources`
- Para cada fonte ativa, buscar CVEs da API correspondente
- Salvar cada CVE individualmente na tabela `cve_cache` (upsert por cve_id + source_id)
- Atualizar `cve_severity_cache` com as contagens agregadas (manter compatibilidade)
- Atualizar `last_sync_at`, `last_sync_status`, `last_sync_count` na fonte

### 6. Paginas de modulo passam a ler do cache

As paginas `FirewallCVEsPage` e `M365CVEsPage` deixam de chamar APIs em tempo real e passam a ler da tabela `cve_cache`, filtrando por `module_code`.

## Arquivos a criar

| Arquivo | Descricao |
|---|---|
| `src/pages/admin/CVEsCachePage.tsx` | Reescrever - pagina central de CVEs |
| `src/components/admin/CVESourcesConfigDialog.tsx` | Novo - dialog de configuracao de fontes |
| `src/hooks/useCVECache.ts` | Novo - hook para ler CVEs do cache |

## Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/refresh-cve-cache/index.ts` | Ler fontes de `cve_sources`, salvar CVEs individuais em `cve_cache` |
| `src/pages/firewall/FirewallCVEsPage.tsx` | Ler de `cve_cache` em vez de chamar API em tempo real |
| `src/pages/m365/M365CVEsPage.tsx` | Ler de `cve_cache` em vez de chamar API em tempo real |
| `src/hooks/useFirewallCVEs.ts` | Refatorar para ler do cache |
| `src/hooks/useM365CVEs.ts` | Refatorar para ler do cache |

## Migracao de banco de dados

- Criar tabela `cve_sources` com dados iniciais (seed) para as 2 fontes atuais (NIST NVD para firewalls, MSRC para M365)
- Criar tabela `cve_cache` com indices
- RLS policies para ambas
- Manter `cve_severity_cache` existente para compatibilidade com o dashboard

## Ordem de implementacao

1. Migracao: criar tabelas `cve_sources` e `cve_cache`
2. Atualizar Edge Function `refresh-cve-cache` para popular ambas as tabelas
3. Criar `useCVECache` hook
4. Reescrever `CVEsCachePage.tsx` com a nova UI
5. Criar `CVESourcesConfigDialog.tsx`
6. Refatorar paginas de modulo para ler do cache
