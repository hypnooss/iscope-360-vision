
# Redesign do Painel Lateral de Detalhes do Ativo

## Resumo
Refazer o painel lateral (Sheet) que abre ao clicar em um card de ativo na "Saude dos Ativos", reorganizando as informacoes em abas (Tabs) para exibir nao apenas os achados/triggers, mas tambem portas abertas, servicos detectados, CVEs vinculadas e certificados TLS -- tudo filtrado para aquele host especifico.

## Estrutura das Abas

O painel lateral tera 4 abas:

1. **Resumo** (aba padrao) -- Visao geral com mini-cards de portas, servicos, CVEs e certificados, alem dos achados/triggers existentes
2. **Servicos** -- Lista de todas as portas abertas com detalhes dos servicos (produto, versao, banner, scripts NSE)
3. **CVEs** -- CVEs vinculadas aos servicos detectados neste host (com severidade, score CVSS e link)
4. **Certificados** -- Certificados TLS encontrados (subject, issuer, validade, dias restantes)

## Detalhes Tecnicos

### Arquivo 1: Novo componente `src/components/surface/AssetDetailSheet.tsx`

Criar um novo componente dedicado ao detalhe de ativos, substituindo o uso do `CategoryDetailSheet` quando `sheetAssetIp` esta definido.

- **Props**: recebe o `ExposedAsset` completo (hostname, ip, ports, services, webServices, tlsCerts, cves, allTechs) + findings filtrados + estado open/onOpenChange
- **Header**: Hostname (IP) com badge de ASN e status geral do ativo (como no card)
- **Tabs (Radix Tabs)**: 4 abas conforme descrito acima

#### Aba "Resumo"
- 4 mini stat-cards em grid 2x2: Portas abertas, Servicos, CVEs, Certificados
- Lista de achados/triggers (os `SurfaceFindingCard` atuais), mantendo o comportamento existente

#### Aba "Servicos"
- Tabela/lista com cada servico: porta, protocolo, produto/nome, versao, banner
- Web services: URL, status code, server, tecnologias detectadas
- Scripts NSE expandiveis (se existirem)

#### Aba "CVEs"
- Lista de CVEs vinculadas, ordenadas por score (desc)
- Cada CVE mostra: ID (link para advisory), titulo, severidade (badge colorido), score CVSS
- Produtos afetados listados como badges

#### Aba "Certificados"
- Cards para cada certificado TLS: Subject CN, Issuer, Data de expiracao, Dias restantes
- Status visual (expirado = vermelho, expirando = amarelo, valido = verde)

### Arquivo 2: `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`

- Quando `sheetAssetIp` esta definido, renderizar o novo `AssetDetailSheet` em vez do `CategoryDetailSheet`
- Passar o asset encontrado por IP (`assets.find(a => a.ip === sheetAssetIp)`) como prop
- O `CategoryDetailSheet` continua sendo usado para cliques em categorias e findings individuais

### Arquivo 3: `src/components/surface/CategoryDetailSheet.tsx`

- Sem alteracoes -- continua funcionando para categorias e findings individuais
