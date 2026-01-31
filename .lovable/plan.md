

# Plano: Atualização do Header de Compliance de Domínio Externo + Cores de Categoria

## Objetivo
1. Remover shadow do card no FirewallReportPreview
2. Substituir o header atual (ScoreGauge + card de info) da página de Análise de Compliance de Domínio Externo pelo novo "Command Center Header"
3. Aplicar nova paleta de cores nas categorias

---

## Parte 1: FirewallReportPreview - Remover Shadow

### Arquivo: `src/pages/preview/FirewallReportPreview.tsx`

**Linha 164**: Remover a propriedade `boxShadow`:

```tsx
// ANTES:
style={{
  background: "linear-gradient(145deg, hsl(220 18% 11%), hsl(220 18% 8%))",
  boxShadow: "0 0 60px hsl(175 80% 45% / 0.08), 0 4px 24px hsl(220 20% 0% / 0.4)"
}}

// DEPOIS:
style={{
  background: "linear-gradient(145deg, hsl(220 18% 11%), hsl(220 18% 8%))"
}}
```

---

## Parte 2: ExternalDomainAnalysisReportPage - Novo Command Center Header

### Arquivo: `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`

#### 2.1 Adicionar componentes MiniStat e DetailRow

Copiar os componentes `MiniStat` e `DetailRow` do DomainReportPreview (linhas 28-135).

#### 2.2 Extrair status de SPF/DKIM/DMARC dos dados reais

Criar função para derivar o status de autenticação de email a partir das categorias:

```tsx
const deriveEmailAuthStatus = (categories: ComplianceCategory[]) => {
  const allChecks = categories.flatMap(c => c.checks);
  
  // SPF: buscar check SPF-001 (SPF Configurado)
  const spfCheck = allChecks.find(c => c.id === 'SPF-001');
  const spf = spfCheck?.status === 'pass';
  
  // DKIM: buscar check DKIM-001 (DKIM Configurado)
  const dkimCheck = allChecks.find(c => c.id === 'DKIM-001');
  const dkim = dkimCheck?.status === 'pass';
  
  // DMARC: buscar check DMARC-001 (DMARC Configurado)
  const dmarcCheck = allChecks.find(c => c.id === 'DMARC-001');
  const dmarc = dmarcCheck?.status === 'pass';
  
  return { spf, dkim, dmarc };
};
```

#### 2.3 Substituir o bloco de header atual (linhas 499-586)

Remover:
- Grid de 3 colunas com ScoreGauge + card de info + StatCards
- Card atual com ícone Globe, info de domínio/nameservers/SOA/DNSSEC
- StatCards (Total, Aprovadas, Falhas, Alertas)

Substituir pelo **Command Center Header**:

```tsx
{/* COMMAND CENTER HEADER */}
<div className="max-w-full mb-8">
  <div 
    className="relative overflow-hidden rounded-2xl border border-primary/20"
    style={{
      background: "linear-gradient(145deg, hsl(220 18% 11%), hsl(220 18% 8%))"
    }}
  >
    {/* Grid pattern overlay */}
    <div 
      className="absolute inset-0 opacity-30 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(hsl(175 80% 45% / 0.03) 1px, transparent 1px),
          linear-gradient(90deg, hsl(175 80% 45% / 0.03) 1px, transparent 1px)
        `,
        backgroundSize: "32px 32px"
      }}
    />

    <div className="relative p-8">
      {/* Identification Strip */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold tracking-[0.2em] text-foreground uppercase">
          {domain?.domain}
        </h2>
        <div className="h-0.5 w-48 mx-auto mt-3 bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        
        {/* Left Panel: Score + Stats */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative">
            <div 
              className="absolute inset-0 blur-3xl opacity-20"
              style={{ background: "radial-gradient(circle, hsl(175 80% 45%), transparent 70%)" }}
            />
            <ScoreGauge score={report.overallScore} size={180} />
          </div>

          {/* Mini Stats Row */}
          <div className="flex gap-3 mt-6">
            <MiniStat value={report.totalChecks} label="Total" variant="primary" />
            <MiniStat value={report.passed} label="Aprovadas" variant="success" />
            <MiniStat value={report.failed} label="Falhas" variant="destructive" />
          </div>
        </div>

        {/* Right Panel: Details */}
        <div className="flex flex-col justify-center lg:border-l lg:border-border/30 lg:pl-8">
          <DetailRow label="SOA Primary" value={dnsSummary?.soaMname || 'N/A'} />
          <DetailRow label="Nameservers" value={dnsSummary?.ns || []} />
          <DetailRow label="Contato SOA" value={dnsSummary?.soaContact || 'N/A'} />
          <DetailRow 
            label="DNSSEC" 
            value={dnssecStatus === 'Ativo' ? "Ativo" : "Inativo"} 
            indicator={dnssecStatus === 'Ativo' ? "success" : "error"}
          />
          <DetailRow 
            label="SPF" 
            value={emailAuth.spf ? "Válido" : "Ausente"} 
            indicator={emailAuth.spf ? "success" : "error"}
          />
          <DetailRow 
            label="DKIM" 
            value={emailAuth.dkim ? "Válido" : "Ausente"} 
            indicator={emailAuth.dkim ? "success" : "error"}
          />
          <DetailRow 
            label="DMARC" 
            value={emailAuth.dmarc ? "Válido" : "Ausente"} 
            indicator={emailAuth.dmarc ? "success" : "error"}
          />
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## Parte 3: Nova Paleta de Cores para Categorias

### Arquivo: `src/components/external-domain/ExternalDomainCategorySection.tsx`

Substituir o mapeamento `CATEGORY_COLORS` atual pela nova paleta:

| Categoria | Cor Atual | Nova Cor Hex | Classe Tailwind |
|-----------|-----------|--------------|-----------------|
| SPF | sky-500 | #5A84A0 | `[#5A84A0]` |
| DKIM | blue-500 | #8A6FAE | `[#8A6FAE]` |
| DMARC | violet-500 | #5DAA9A | `[#5DAA9A]` |
| Segurança DNS | teal-500 | #C58CA7 | `[#C58CA7]` |
| Infraestrutura de Email | purple-500 | #6273C3 | `[#6273C3]` |

**Novas cores disponíveis (reserva)**:
- `#8FA37A` - Verde oliva
- `#6FAF8F` - Verde menta

```tsx
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Autenticação de Email - SPF': { 
    bg: 'bg-[#5A84A0]/10', 
    text: 'text-[#5A84A0]', 
    border: 'border-[#5A84A0]/30' 
  },
  'Autenticação de Email - DKIM': { 
    bg: 'bg-[#8A6FAE]/10', 
    text: 'text-[#8A6FAE]', 
    border: 'border-[#8A6FAE]/30' 
  },
  'Autenticação de Email - DMARC': { 
    bg: 'bg-[#5DAA9A]/10', 
    text: 'text-[#5DAA9A]', 
    border: 'border-[#5DAA9A]/30' 
  },
  'Segurança DNS': { 
    bg: 'bg-[#C58CA7]/10', 
    text: 'text-[#C58CA7]', 
    border: 'border-[#C58CA7]/30' 
  },
  'Infraestrutura de Email': { 
    bg: 'bg-[#6273C3]/10', 
    text: 'text-[#6273C3]', 
    border: 'border-[#6273C3]/30' 
  },
};
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/preview/FirewallReportPreview.tsx` | Remover `boxShadow` |
| `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx` | Substituir header por Command Center |
| `src/components/external-domain/ExternalDomainCategorySection.tsx` | Nova paleta de cores |

---

## Resumo Visual

### Header Antes vs Depois

| Elemento | Antes | Depois |
|----------|-------|--------|
| Layout | 3 colunas (gauge / info+stats) | 2 colunas (gauge+stats / info) |
| Score | Gauge isolado em card | Gauge 180px com glow radial |
| Stats | StatCards em grid separado | MiniStats abaixo do gauge |
| Info | Card com ícone Globe + rows | DetailRows com indicadores ● |
| SPF/DKIM/DMARC | Não exibidos | Exibidos com status Válido/Ausente |

### Categorias

| Categoria | Antes | Depois |
|-----------|-------|--------|
| SPF | `sky-500` | `#5A84A0` (azul acinzentado) |
| DKIM | `blue-500` | `#8A6FAE` (lilás) |
| DMARC | `violet-500` | `#5DAA9A` (verde água) |
| DNS | `teal-500` | `#C58CA7` (rosa suave) |
| Email | `purple-500` | `#6273C3` (azul índigo) |

