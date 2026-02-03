

## Mapa DNS Visual para Domínios Externos

### Objetivo

Substituir a tabela de subdomínios por uma visualização em árvore/mapa hierárquico mostrando toda a infraestrutura DNS do domínio, similar ao estilo DNSDumpster.

### Design do Mapa

O mapa terá layout vertical (infinito na vertical, limitado na horizontal) com o domínio principal no topo, ramificando para os diferentes tipos de registros:

```
                    ┌─────────────────────────┐
                    │   taschibra.com.br      │  ← Domínio Principal
                    │   ● Score: 85%          │
                    └───────────┬─────────────┘
                                │
        ┌───────────┬───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
   │   NS    │ │   MX    │ │   SOA   │ │   TXT   │ │ SUBDM.  │
   └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
        │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ns1-06.  │ │outlook. │ │Primary: │ │SPF: ✓   │ │www ●    │
   │azure... │ │mail...  │ │ns1-06   │ │DKIM: ✓  │ │drive ●  │
   └────┬────┘ └─────────┘ │Contact: │ │DMARC: ✓ │ │ida-fw ● │
        │                  │admin@   │ └─────────┘ │chat ○   │
        ▼                  └─────────┘             │mail ○   │
   ┌─────────┐                                     └─────────┘
   │ns2-06.  │
   │azure... │
   └─────────┘
   ...
```

### Estrutura de Dados para o Mapa

Todos os dados necessários já estão disponíveis no relatório:

| Tipo | Fonte no Report | Dados |
|------|-----------------|-------|
| **NS** | `dnsSummary.ns[]` | Lista de nameservers |
| **MX** | `categories['Configuração de Email - MX'].checks[0].rawData.data.records[]` | Exchange, Priority, IPs |
| **SOA** | `dnsSummary.soaMname`, `dnsSummary.soaContact` | Primary NS, Contact |
| **TXT** | Checks SPF, DKIM, DMARC via `deriveEmailAuthStatus()` | Status pass/fail |
| **Subdomínios** | `subdomainSummary.subdomains[]` | Subdomain, IPs, is_alive |
| **DNSSEC** | `dnsSummary.dnssecHasDnskey`, `dnssecHasDs` | Status ativo/inativo |

### Componentes a Criar

#### 1. `src/components/external-domain/DNSMapSection.tsx` (Novo)

Componente principal que renderiza o mapa DNS completo:

```tsx
interface DNSMapSectionProps {
  domain: string;
  dnsSummary?: ComplianceReport['dnsSummary'];
  subdomainSummary?: SubdomainSummary;
  categories: ComplianceCategory[];
  emailAuth: { spf: boolean; dkim: boolean; dmarc: boolean };
}
```

Estrutura visual:
- **Card container** com fundo escuro e grid pattern (mesmo estilo do Command Center)
- **Nó raiz**: Domínio principal (centralizado no topo)
- **Linhas de conexão**: SVG paths conectando os nós
- **Nós filhos**: Grupos de registros (NS, MX, SOA, TXT, Subdomínios)
- **Nós folha**: Registros individuais dentro de cada grupo

#### 2. Componentes Auxiliares

```tsx
// Nó individual do mapa
function DNSMapNode({ 
  type, 
  label, 
  value, 
  status,
  children,
  isRoot
}: DNSMapNodeProps)

// Linha de conexão SVG
function DNSMapConnector({ 
  from, 
  to, 
  type 
}: DNSMapConnectorProps)

// Grupo de registros expansível
function DNSMapGroup({
  type,
  title,
  items,
  icon,
  color
}: DNSMapGroupProps)
```

### Layout Responsivo

O mapa será renderizado em CSS puro (sem bibliotecas externas como D3) para simplicidade:

- **Desktop (lg+)**: Layout horizontal com 5 colunas (NS, MX, SOA, TXT, Subdomínios)
- **Tablet (md)**: Layout 2-3 colunas com scroll vertical
- **Mobile**: Layout em lista vertical (uma coluna)

### Cores por Tipo de Registro

| Tipo | Cor (Tailwind) | Hex |
|------|---------------|-----|
| NS | `sky-400` | #38bdf8 |
| MX | `purple-400` | #c084fc |
| SOA | `amber-400` | #fbbf24 |
| TXT | `emerald-400` | #34d399 |
| Subdomínios | `teal-400` | #2dd4bf |
| Ativo | `primary` | Tema |
| Inativo | `muted-foreground/30` | Cinza |

### Funcionalidades

1. **Status visual**: Indicador verde/cinza para registros ativos/inativos
2. **Hover details**: Tooltip com informações completas ao passar o mouse
3. **Clique para copiar**: Copiar hostname/IP ao clicar
4. **Expandir/Colapsar**: Grupos com muitos itens (ex: subdomínios) colapsáveis
5. **Busca**: Filtro para encontrar registros específicos (reutilizar da tabela)
6. **Link externo**: Ícone para abrir subdomínio em nova aba

### Alterações Necessárias

#### Arquivos a Modificar

1. **`src/components/external-domain/DNSMapSection.tsx`** (criar)
   - Novo componente principal do mapa

2. **`src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`** (modificar)
   - Substituir `<SubdomainSection>` por `<DNSMapSection>`
   - Passar todos os dados necessários (dnsSummary, subdomainSummary, categories, emailAuth)

3. **`src/components/external-domain/SubdomainSection.tsx`** (manter)
   - Manter para compatibilidade, mas não será usado na página principal

4. **`src/types/compliance.ts`** (opcional)
   - Adicionar tipos para MX records se necessário

### Extração de Dados MX

Para extrair os registros MX do relatório:

```tsx
const extractMxRecords = (categories: ComplianceCategory[]) => {
  const mxCategory = categories.find(c => c.name.includes('MX'));
  if (!mxCategory) return [];
  
  const mxCheck = mxCategory.checks.find(ch => ch.rawData?.step_id === 'mx_records');
  const records = (mxCheck?.rawData?.data as any)?.records || [];
  
  return records.map((r: any) => ({
    exchange: r.exchange,
    priority: r.priority,
    ips: r.resolved_ips || [],
    ipCount: r.resolved_ip_count || 0
  }));
};
```

### Exemplo Visual (ASCII)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         MAPA DE INFRAESTRUTURA DNS                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                          ┌─────────────────────┐                            │
│                          │  taschibra.com.br   │                            │
│                          └──────────┬──────────┘                            │
│                                     │                                       │
│      ┌──────────┬──────────┬────────┴────────┬──────────┬──────────┐       │
│      │          │          │                 │          │          │       │
│   ┌──▼──┐   ┌──▼──┐   ┌──▼──┐           ┌──▼──┐   ┌──▼──┐         │       │
│   │ NS  │   │ MX  │   │ SOA │           │ TXT │   │ SUB │         │       │
│   │ 4   │   │ 1   │   │     │           │ 3   │   │ 10  │         │       │
│   └──┬──┘   └──┬──┘   └──┬──┘           └──┬──┘   └──┬──┘         │       │
│      │         │         │                 │         │            │       │
│   ns1-06...  outlook  Primary:           SPF ✓    ● www          │       │
│   ns2-06...  .mail.   ns1-06...         DKIM ✓    ● drive        │       │
│   ns3-06...  outlook  Contact:          DMARC ✓   ● ida-fw       │       │
│   ns4-06...  .com     admin@...                   ○ chat         │       │
│                       DNSSEC: ✗                   ○ mail         │       │
│                                                   ○ mx2          │       │
│                                                   ○ ns1          │       │
│                                                   ○ ns2          │       │
│                                                   ○ ns3          │       │
│                                                   ○ vpn          │       │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### Tecnologias Utilizadas

- **CSS Grid/Flexbox**: Layout responsivo
- **SVG inline**: Linhas de conexão
- **Tailwind CSS**: Estilos consistentes com o tema
- **Framer Motion** (opcional): Animações suaves de expansão

### Ordem de Implementação

1. Criar estrutura base do `DNSMapSection`
2. Implementar nós individuais (DNSMapNode)
3. Adicionar linhas de conexão SVG
4. Implementar grupos expansíveis
5. Integrar na página de relatório
6. Adicionar funcionalidades (busca, copiar, tooltips)
7. Responsividade mobile

