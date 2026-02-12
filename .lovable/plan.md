# Attack Surface Analyzer - Modulo de Analise de Superficie de Ataque

## Visao Geral

Novo submodulo dentro de Dominio Externo que cruza IPs publicos de duas fontes (DNS de dominios externos + interfaces WAN de firewalls) para descobrir portas abertas, servicos expostos e CVEs associadas. Utiliza abordagem hibrida: APIs externas (Shodan) para enriquecimento rapido + Agent Python para scan ativo complementar.

## Pre-requisitos Identificados

### Dados ja disponiveis

- **IPs de DNS**: A enumeracao de subdominios (`subdomain-enum`) resolve IPs via DoH, mas o `subdomainSummary` nem sempre esta persistido no `report_data` das analises de agent. Precisa de ajuste.
- **IPs de interfaces WAN**: O step `system_interface` retorna todas as interfaces com campo `ip` (formato `"10.0.0.13 255.255.255.255"`). Interfaces WAN sao identificaveis pelo tipo de interface (ex: `wan`). Nota: muitos IPs WAN sao privados (NAT do ISP).

### Gaps a resolver

1. **API Key do Shodan**: Necessario adicionar secret `SHODAN_API_KEY` para consultas de portas/servicos por IP
2. **Persistencia de IPs publicos**: Garantir que os IPs dos subdominios e das interfaces WAN sejam extraidos e armazenados de forma acessivel
3. **Tabela de resultados**: Nova tabela para armazenar os resultados de scan de superficie

## Arquitetura

O fluxo sera:

1. Usuario acessa a tela "Analyzer" no menu de Dominio Externo
2. Sistema coleta IPs publicos de duas fontes:
  - `external_domain_analysis_history.report_data` -> subdominios com IPs resolvidos
  - `analysis_history.report_data` -> interfaces WAN do firewall (filtrando apenas IPs publicos, ou seja, nao RFC1918)
3. Edge Function `attack-surface-scan` envia IPs para a API do Shodan (`/shodan/host/{ip}`)
4. Resultados (portas abertas, servicos, versoes) sao persistidos na tabela `attack_surface_snapshots`
5. Correlacao com CVEs via `cve_cache` existente (match por CPE do servico)
6. Agent Python pode complementar com scan direto (nmap-like) em fase posterior

## Plano de Implementacao

### Fase 1: Infraestrutura de Dados

**1.1 Nova tabela: `attack_surface_snapshots**`

```text
id              UUID PK
client_id       UUID NOT NULL (FK clients)
status          TEXT DEFAULT 'pending' (pending, processing, completed, failed)
source_ips      JSONB  -- lista de IPs com origem (dns/firewall) e metadata
results         JSONB  -- portas abertas, servicos, versoes por IP
cve_matches     JSONB  -- CVEs correlacionadas
summary         JSONB  -- contadores (total_ips, open_ports, services, cves)
score           INTEGER -- score de exposicao (0-100, onde 100 = muito exposto)
created_at      TIMESTAMPTZ DEFAULT now()
completed_at    TIMESTAMPTZ
created_by      UUID
```

**1.2 RLS Policies**

- SELECT: `has_client_access(auth.uid(), client_id)`
- INSERT: Admins com permissao edit/full em external_domain
- ALL: service_role

### Fase 2: Coleta de IPs Publicos

**2.1 Edge Function: `attack-surface-scan**`

Responsabilidades:

- Receber `client_id` como parametro
- Buscar ultimo relatorio de cada dominio externo do cliente -> extrair IPs dos subdominios
- Buscar ultimo relatorio de cada firewall do cliente -> extrair IPs das interfaces WAN
- Filtrar apenas IPs publicos (descartar RFC1918: 10.x, 172.16-31.x, 192.168.x)
- Para cada IP publico, consultar Shodan API (`/shodan/host/{ip}`)
- Consolidar resultados: IP, portas, servicos, versoes, banners
- Correlacionar servicos com CVEs no `cve_cache` (match por produto/versao)
- Persistir snapshot na tabela `attack_surface_snapshots`

**2.2 Logica de extracao de IPs**

De dominios externos:

- Navegar em `report_data.checks[*].rawData` buscando steps de DNS que contenham IPs
- Buscar `subdomainSummary.subdomains[*].addresses[*].ip` quando disponivel

De firewalls:

- Navegar em `task_step_results` onde `step_id = 'system_interface'`
- Filtrar interfaces onde `name` contem "WAN" ou `role = 'wan'`
- Extrair campo `ip` (formato "IP MASK") e separar apenas o IP
- Descartar IPs privados

### Fase 3: Interface (Frontend)

**3.1 Menu condicional no AppLayout**

Adicionar item "Analyzer" no menu de `scope_external_domain`, porem so exibir quando:

- Existir pelo menos 1 analise completa de dominio externo
- E existir pelo menos 1 analise completa de firewall
- Ambos para o mesmo `client_id`

**3.2 Rota: `/scope-external-domain/analyzer**`

**3.3 Pagina: `AttackSurfaceAnalyzerPage.tsx**`

Layout similar ao Analyzer de Firewall, com:

- **Cards de resumo**: Total IPs publicos, Portas abertas, Servicos descobertos, CVEs encontradas
- **Tabela principal**: Lista de IPs com colunas:
  - IP | Origem (DNS/Firewall) | Portas abertas | Servicos | CVEs | Risco
- **Detalhe por IP** (expandivel): Lista de portas com servico, versao, banner e CVEs vinculadas
- **Botao "Executar Scan"**: Dispara a edge function `attack-surface-scan`

### Fase 4: Agent Python (complementar, fase futura)

**4.1 Novo executor: `port_scanner.py**`

- Scan TCP de portas comuns (top 100 ou top 1000)
- Banner grabbing basico para fingerprinting
- Resultados enviados via `agent-step-result`

**4.2 Blueprint para device_type `external_domain**`

- Novo step com `executor: 'agent'` e tipo `port_scan`
- Configuravel via Templates na administracao

## Segredos Necessarios


| Secret           | Descricao                                       | Necessario para                     |
| ---------------- | ----------------------------------------------- | ----------------------------------- |
| `SHODAN_API_KEY` | API key do Shodan (plano Developer ou superior) | Edge Function `attack-surface-scan` |


## Resumo de Arquivos


| Arquivo                                                   | Tipo          | Descricao                                      |
| --------------------------------------------------------- | ------------- | ---------------------------------------------- |
| Migracao SQL                                              | DB            | Tabela `attack_surface_snapshots` + RLS        |
| `supabase/functions/attack-surface-scan/index.ts`         | Edge Function | Coleta IPs, consulta Shodan, correlaciona CVEs |
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` | Pagina        | Tela principal do Analyzer                     |
| `src/hooks/useAttackSurfaceData.ts`                       | Hook          | Busca dados do snapshot mais recente           |
| `src/components/layout/AppLayout.tsx`                     | Modificacao   | Menu condicional "Analyzer"                    |
| `src/App.tsx`                                             | Modificacao   | Nova rota `/scope-external-domain/analyzer`    |


## Dependencias externas

- **Shodan API**: Plano "Developer" ($49/mes) ou superior. Endpoint `/shodan/host/{ip}` retorna portas, servicos, banners, CVEs. Rate limit: 1 req/seg no plano basico.
- Alternativa gratuita parcial: **Censys Search** (free tier com 250 queries/mes)  
Usar tambem **SecurityTrails e VirusTotal para enriquecer** 

## Ordem de Implementacao

1. Adicionar secret `SHODAN_API_KEY`
2. Criar tabela `attack_surface_snapshots` com RLS
3. Criar edge function `attack-surface-scan`
4. Criar pagina e hook frontend
5. Adicionar menu condicional e rota
6. Testar end-to-end com dados reais