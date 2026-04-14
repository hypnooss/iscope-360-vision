

## Plano — PDF parcialmente ofuscado + PDF do Surface Analyzer

### Resumo

Duas entregas:
1. O PDF de Domain Compliance na página pública (`/report/:token`) deve mostrar conteúdo completo apenas até o **Mapa de Infraestrutura DNS** (página 3). As páginas seguintes (subdomínios, guia de correções, verificações aprovadas, plano de ação) devem ser **ofuscadas** com overlay de blur e CTA "Adquira o relatório completo".
2. Criar um novo componente **`SurfaceAnalyzerPDF`** no mesmo padrão visual do `ExternalDomainPDF`, exibindo dados do Surface Analyzer (IPs, portas, serviços, CVEs, findings por categoria).

### Alterações

**1. Criar `ExternalDomainPDFDemo` — versão truncada do PDF**

Arquivo: `src/components/pdf/ExternalDomainPDFDemo.tsx`

- Renderiza as 3 primeiras páginas normalmente (Executive Summary, Infrastructure Summary, DNS Map)
- Para as páginas seguintes (subdomains, guia de correções, passed checks, action plan), aplica um overlay visual com:
  - Texto borrado/ofuscado (cores muito claras, sem contraste legível)
  - Overlay semitransparente com texto "Conteúdo disponível na versão completa"
  - Mantém o layout/estrutura para mostrar que há mais conteúdo
- Aceita as mesmas props do `ExternalDomainPDF`

**2. Atualizar `PublicReportPage.tsx`**

- Importar `ExternalDomainPDFDemo` em vez de `ExternalDomainPDF`
- Buscar também dados de `attack_surface_snapshots` para o client_id do job
- Passar dados do snapshot para o novo `SurfaceAnalyzerPDF`
- Oferecer dois botões de download: "PDF Compliance (Demo)" e "PDF Surface Analyzer (Demo)"

**3. Criar `SurfaceAnalyzerPDF`**

Arquivo: `src/components/pdf/SurfaceAnalyzerPDF.tsx`

Estrutura do PDF (usando `@react-pdf/renderer` e os mesmos estilos/sections compartilhados):

- **Página 1**: Header + Posture Overview (score do snapshot, contagem de IPs, portas, serviços, CVEs)
- **Página 2**: Lista de Assets (IPs escaneados com hostname, ASN, portas abertas, OS)
- **Página 3**: Serviços detectados (tabela com porta, protocolo, produto, versão)
- **Página 4**: CVEs encontradas (tabela com CVE ID, severity, score, produto afetado)
- **Página 5**: Web Services (URLs, status, tecnologias, TLS info)
- **Página final**: Resumo/Action Plan

Reutiliza: `PDFHeader`, `PDFFooter`, `PDFPostureOverview`, estilos de `pdfStyles`.

**4. Criar `SurfaceAnalyzerPDFDemo`** — versão ofuscada

Mesma lógica: mostra 2-3 primeiras páginas completas, restante ofuscado.

**5. Atualizar `PublicReportPage` para buscar dados de attack surface**

- Busca `attack_surface_snapshots` via `client_id` do job (já temos RLS para anon)
- Se houver snapshot, renderiza cards de resumo do Surface Analyzer na página pública
- Ambos PDFs (Compliance Demo + Surface Demo) disponíveis para download

**6. Adicionar RLS para `attack_surface_snapshots` (migration)**

- Policy para `anon` ler snapshots vinculados a jobs com `access_token` válido

### Detalhes técnicos

A ofuscação no PDF (`@react-pdf/renderer`) será feita com:
- Texto renderizado com `color: '#E5E5E5'` (quase branco) ou `opacity: 0.1`
- View overlay posicionada sobre o conteúdo com `backgroundColor` semitransparente
- Texto centralizado "🔒 Conteúdo disponível na versão completa" sobre o overlay

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/pdf/ExternalDomainPDFDemo.tsx` | Novo — versão truncada/ofuscada |
| `src/components/pdf/SurfaceAnalyzerPDF.tsx` | Novo — PDF completo do Surface Analyzer |
| `src/components/pdf/SurfaceAnalyzerPDFDemo.tsx` | Novo — versão truncada/ofuscada |
| `src/pages/PublicReportPage.tsx` | Atualizar — usar Demo PDFs + buscar attack surface data |
| Migration SQL | RLS para anon ler `attack_surface_snapshots` via job token |

