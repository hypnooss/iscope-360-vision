

# Redesign do Surface Analyzer - Pagina de Prototipo

## Contexto

A pagina atual do Surface Analyzer (`AttackSurfaceAnalyzerPage.tsx`) tem ~1800 linhas e exibe todas as informacoes de forma linear e congestionada: stat cards no topo, lista de assets como cards expandiveis com portas, servicos, CVEs, certificados TLS, tecnologias e credenciais vazadas - tudo na mesma view. Para usuarios nao-tecnicos, e um muro de dados dificil de interpretar.

## Inspiracao e Pesquisa

Analisei dashboards de ferramentas profissionais de Exposure Management (Censys ASM, Qualys EASM, Rapid7 Surface Command, Microsoft Exposure Management) e principios de UX para dashboards de ciberseguranca. Os padroes recorrentes sao:

1. **Dashboard Overview primeiro, detalhes depois** - o usuario ve um resumo executivo antes de mergulhar nos dados
2. **Organizacao por categoria, nao por IP** - agrupar por tipo de achado (servicos web, certificados, CVEs) em vez de listar tudo por ativo
3. **Progressive disclosure** - mostrar o essencial e permitir drill-down
4. **Contadores visuais com contexto** - nao apenas numeros, mas barras/distribuicoes que contam uma historia
5. **Tabelas para dados densos** - cards funcionam para resumo, mas tabelas sao melhores para inventario detalhado

## Proposta de Layout (Pagina de Teste)

A nova pagina sera criada em `/scope-external-domain/analyzer-v2` como prototipo. Estrutura em 3 zonas verticais:

### Zona 1: Header + Summary Cards (visao executiva)

Manter o header padrao do sistema (breadcrumb, titulo, subtitulo, workspace selector). Os stat cards mudam de 4 metricas genericas para metricas que contam uma historia:

| Card | Antes | Depois |
|---|---|---|
| 1 | Ativos Expostos (numero) | **Ativos Monitorados** - total de IPs/hostnames |
| 2 | Servicos Detectados (numero) | **Servicos Expostos** - com mini breakdown (web/infra) |
| 3 | CVEs Criticas (numero) | **Vulnerabilidades** - com breakdown por severidade (badges inline) |
| 4 | Certificados Expirados (numero) | **Certificados** - com status (validos/expirando/expirados) |

### Zona 2: Tabs de Navegacao

Em vez de uma lista unica gigante, organizar os dados em abas tematicas:

```
[Inventario] [Servicos Web] [Vulnerabilidades] [Certificados] [Credenciais Vazadas]
```

**Tab Inventario (padrao):** Tabela limpa com colunas: Hostname | IP | ASN/Provider | Portas | Servicos | CVEs | Status. Cada linha clicavel para expandir detalhes. Ordenacao por colunas.

**Tab Servicos Web:** Tabela focada em endpoints HTTP/HTTPS: URL | Status | Servidor | Tecnologias | TLS. Agrupamento visual por ativo.

**Tab Vulnerabilidades:** Lista de CVEs encontradas, agrupadas por severidade. Cada CVE mostra quais ativos sao afetados. Filtro por severidade.

**Tab Certificados:** Visao dedicada de todos os certificados TLS: Subject | Emissor | Validade | Status. Ordenado por urgencia (expirados primeiro).

**Tab Credenciais Vazadas:** A secao HIBP que ja existe, promovida para tab propria.

### Zona 3: Footer Info

Timestamp do ultimo scan + botao de acao (executar/cancelar).

## Detalhes Tecnicos

### Novo arquivo: `src/pages/external-domain/SurfaceAnalyzerV2Page.tsx`

- Reutilizar toda a logica de dados existente (`buildAssets`, `matchCVEsToIP`, hooks de snapshot, etc.) - copiar do original
- Implementar o layout com `Tabs` do Radix UI (ja instalado)
- Cada tab sera um componente interno (funcao dentro do arquivo ou componente separado se ficar grande)
- Manter todos os hooks existentes: `useWorkspaceSelector`, `useEffectiveAuth`, `usePreview`, queries de CVE cache, etc.

### Rota de teste: `src/App.tsx`

- Adicionar rota `/scope-external-domain/analyzer-v2` apontando para `SurfaceAnalyzerV2Page`
- A rota original `/scope-external-domain/analyzer` permanece inalterada

### Componentes da Tab Inventario (visao principal)

Tabela com as colunas:
- **Hostname**: com icone de fonte (DNS/Firewall) e tooltip de ASN/WHOIS
- **IP**: badge mono com bandeira do pais
- **Portas**: badge com contagem, tooltip com lista
- **Servicos**: badge com contagem
- **CVEs**: badges coloridas por severidade (ex: "2 Critical | 1 High")
- **Certificado**: icone de status (verde/amarelo/vermelho/cinza)
- Linha expandivel com os detalhes do ativo (servicos, scripts NSE, CVEs detalhadas)

### Componentes da Tab Vulnerabilidades

- Cards agrupados por severidade (Critical, High, Medium, Low)
- Cada card de CVE mostra: ID, titulo, score, ativos afetados (badges clicaveis)
- Filtro rapido por severidade

### Componentes da Tab Certificados

Tabela com:
- Subject CN
- Emissor
- Data de expiracao
- Dias restantes (badge colorida)
- Ativo associado

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---|---|
| `src/pages/external-domain/SurfaceAnalyzerV2Page.tsx` | **Criar** - nova pagina de prototipo |
| `src/App.tsx` | **Modificar** - adicionar rota `/scope-external-domain/analyzer-v2` |

## Observacoes

- Sem risk score (conforme solicitado)
- Toda a logica de dados (buildAssets, matchCVEsToIP, CVE cache, progress tracking, scan/cancel, rescan por IP, schedule dialog) sera mantida
- O termo "Surface Analyzer" sera mantido (sem "Attack")
- A pagina original nao sera alterada ate aprovacao do prototipo
- Credenciais vazadas (HIBP) ganha tab propria em vez de ficar no final da pagina

