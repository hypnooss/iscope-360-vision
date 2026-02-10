

# Modulo CVEs Microsoft 365

## Objetivo

Criar uma nova pagina "CVEs" no modulo Microsoft 365 que lista vulnerabilidades conhecidas dos produtos do ecossistema 365 (Exchange Server, Entra ID, SharePoint, Teams, Outlook, etc.), buscando dados de fontes publicas de CVEs.

## Analise das Fontes de Dados

### Opcao 1: MSRC CVRF API (Recomendada)
- **URL**: `https://api.msrc.microsoft.com/cvrf/v3.0/updates`
- **Vantagens**: Fonte oficial da Microsoft, dados estruturados por produto com IDs de produto especificos (Exchange Server, Azure AD/Entra ID, SharePoint, etc.), sem necessidade de API key, atualizada mensalmente no Patch Tuesday
- **Formato**: Documentos CVRF organizados por mes (ex: `2025-Jan`), contendo lista de vulnerabilidades com severity, CVSS score, produtos afetados e remediacao
- **Fluxo**: Listar updates recentes -> Para cada update, buscar documento CVRF -> Filtrar vulnerabilidades por produtos M365

### Opcao 2: NIST NVD API (Complementar)
- **URL**: `https://services.nvd.nist.gov/rest/json/cves/2.0`
- **Vantagens**: Ja utilizada no projeto (fortigate-cve), busca por keyword simples
- **Desvantagens**: Nao tem filtragem nativa por "produto Microsoft 365", depende de keyword search menos preciso, rate-limited sem API key

### Opcao 3: MITRE CVE API
- **URL**: `https://cveawg.mitre.org/api/cve`
- **Desvantagens**: Menos estruturada para filtragem por produto, sem scores CVSS nativos

### Decisao: Usar MSRC como fonte primaria
A API MSRC e a fonte oficial, gratuita, e ja organiza os CVEs por produto Microsoft, tornando trivial filtrar por Exchange, SharePoint, Entra ID, etc. Podemos usar NVD como fallback para enriquecer dados de CVSS quando necessario.

## Arquitetura

### 1. Edge Function: `m365-cves`
- Recebe parametros: `products` (array de produtos M365 a filtrar) e `months` (quantidade de meses recentes, default 3)
- Busca os updates recentes na MSRC API
- Para cada update, busca o documento CVRF completo
- Filtra vulnerabilidades que afetam produtos M365 (Exchange Server, Microsoft 365 Apps, SharePoint, Azure Active Directory, etc.)
- Retorna lista de CVEs com: ID, titulo, severidade, CVSS score, produtos afetados, data de publicacao, link para advisory

### 2. Pagina: `M365CVEsPage`
- Rota: `/scope-m365/cves`
- Cards de resumo no topo: Total de CVEs, Criticos, Altos, Medios
- Filtros por produto (Exchange, SharePoint, Entra ID, Teams, etc.) e por severidade
- Lista de CVEs em cards expansiveis (similar ao pattern do `CVESection` do Firewall)
- Link direto para o advisory oficial da Microsoft (msrc.microsoft.com)
- Seletor de periodo (ultimos 1, 3, 6 meses)

### 3. Navegacao
- Adicionar item "CVEs" no menu lateral do modulo M365 (AppLayout.tsx), com icone `AlertTriangle`

## Detalhes Tecnicos

### Edge Function `m365-cves/index.ts`

```text
Fluxo:
1. GET https://api.msrc.microsoft.com/cvrf/v3.0/updates
   -> Lista de CVRF IDs (ex: "2025-Jan", "2025-Feb")
2. Para cada mes no range solicitado:
   GET https://api.msrc.microsoft.com/cvrf/v3.0/cvrf/{id}
   -> Documento CVRF completo com Vulnerability[]
3. Filtrar Vulnerability[] onde ProductTree inclui
   produtos M365 (Exchange, SharePoint, Entra ID, etc.)
4. Mapear para formato simplificado com CVSS, severity, titulo
5. Ordenar por score (maior primeiro)
6. Retornar JSON ao frontend
```

### Produtos M365 a filtrar (IDs do Product Tree MSRC)
- Microsoft Exchange Server
- Microsoft 365 Apps for Enterprise
- Microsoft SharePoint
- Azure Active Directory / Entra ID
- Microsoft Teams
- Microsoft Outlook
- Microsoft Defender for Endpoint
- Microsoft Intune

### Estrutura do retorno
```text
{
  success: true,
  totalCVEs: number,
  cves: [{
    id: "CVE-2025-XXXXX",
    title: "...",
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    score: 9.8,
    products: ["Exchange Server", "SharePoint"],
    publishedDate: "2025-02-01",
    advisoryUrl: "https://msrc.microsoft.com/update-guide/vulnerability/CVE-2025-XXXXX",
    description: "..."
  }],
  source: "Microsoft Security Response Center"
}
```

### Frontend

**Novos arquivos:**
- `src/pages/m365/M365CVEsPage.tsx` - Pagina principal com filtros, resumo e lista
- `src/hooks/useM365CVEs.ts` - Hook com React Query para buscar e cachear os CVEs

**Arquivos modificados:**
- `src/App.tsx` - Nova rota `/scope-m365/cves`
- `src/components/layout/AppLayout.tsx` - Novo item "CVEs" no menu M365
- `supabase/config.toml` - Registro da nova edge function

### Visual da Pagina
- Header com TenantSelector (padrao M365) e titulo "CVEs - Produtos Microsoft 365"
- Row de StatCards: Total, Criticos (vermelho), Altos (laranja), Medios (amarelo)
- Barra de filtros: chips de produto (multi-select), dropdown de severidade, seletor de periodo
- Lista de CVE cards com: badge de severidade colorido, ID clicavel (link externo MSRC), titulo, produtos afetados como badges, data de publicacao
- Disclaimer informativo sobre a fonte (MSRC)

