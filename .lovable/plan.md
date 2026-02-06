
# Plano: Adaptar Layout do Relatorio M365 ao Padrao Command Center

## Resumo

Refatorar a pagina `M365PostureReportPage.tsx` para seguir o mesmo padrao visual "Command Center" utilizado nos relatorios de Dominio Externo e Firewall, mantendo o gauge atual (`M365ScoreGauge`) que possui estilo escuro com arco e shadow.

## Comparacao Visual

### Layout Atual M365
```
┌──────────────────────────────────────────────────────────────────┐
│ Header simples com botao Voltar + titulo                         │
├──────────────────────────────────────────────────────────────────┤
│ ┌────────────────────┐  ┌────────────────────────────────────────┤
│ │ Card com Gauge     │  │ Card: Resumo por Severidade           │
│ │ + Badge            │  │ (grid 5 colunas de mini-cards)        │
│ └────────────────────┘  └────────────────────────────────────────┤
├──────────────────────────────────────────────────────────────────┤
│ Card: Categorias (grid 4 colunas de M365CategoryCard)            │
├──────────────────────────────────────────────────────────────────┤
│ Card: Verificacoes                                               │
│   Tabs: Problemas | Conformes                                    │
│   Lista de M365InsightCard                                       │
└──────────────────────────────────────────────────────────────────┘
```

### Layout Novo (Padrao Command Center)
```
┌──────────────────────────────────────────────────────────────────┐
│ Breadcrumb                                                       │
├──────────────────────────────────────────────────────────────────┤
│ Header: "Analise de Conformidade" | Data | [PDF] [Reanalisar]   │
├──────────────────────────────────────────────────────────────────┤
│ ╔════════════════════════════════════════════════════════════════╗
│ ║              COMMAND CENTER HEADER                            ║
│ ║  ─────────────────────────────────────────────────────────────║
│ ║                    TENANT DISPLAY NAME                        ║
│ ║              ═══════════════════════                          ║
│ ║                                                               ║
│ ║  ┌──────────────────────┐  │  Workspace: ACME Corp            ║
│ ║  │                      │  │  Dominio: contoso.onmicrosoft.com║
│ ║  │   M365ScoreGauge     │  │  Data: 15/01/2026 14:30          ║
│ ║  │   (manter atual)     │  │  ────────────────────────────────║
│ ║  │                      │  │  Criticos:    ● 3                ║
│ ║  └──────────────────────┘  │  Alta:        ● 5                ║
│ ║                            │  Media:       ○ 8                ║
│ ║  [Total] [Passou] [Falha]  │  Baixa:       ○ 12               ║
│ ╚════════════════════════════════════════════════════════════════╝
├──────────────────────────────────────────────────────────────────┤
│ Banner: X problemas criticos encontrados (se houver)             │
├──────────────────────────────────────────────────────────────────┤
│ "Verificacoes por Categoria"                                     │
│ ┌─────────────────────────────────────────────────────────────── │
│ │ CategorySection: Identidades (colapsavel)                     │
│ │   └─ M365InsightCard, M365InsightCard...                      │
│ │ CategorySection: Autenticacao e Acesso                        │
│ │   └─ M365InsightCard, M365InsightCard...                      │
│ │ ...                                                           │
│ └─────────────────────────────────────────────────────────────── │
└──────────────────────────────────────────────────────────────────┘
```

## Elementos a Manter/Adaptar

### Manter (do M365 atual)
- **M365ScoreGauge**: Gauge estilizado com fundo escuro, arco claro e shadow (conforme solicitado)
- **M365InsightCard**: Cards de insight com expansao, remediation dialog, etc.
- **M365RemediationDialog**: Dialog com passos de correcao

### Adaptar para Padrao Command Center
1. **MiniStat**: Reutilizar componente inline (Total/Aprovadas/Falhas)
2. **DetailRow**: Reutilizar para exibir detalhes do tenant no painel direito
3. **Command Center Container**: Fundo gradiente escuro com grid pattern
4. **CategorySection estilo M365**: Criar `M365CategorySection` com cabecalho colapsavel

### Remover/Substituir
- Cards separados de Gauge e Severity Breakdown (consolidar no Command Center)
- Card de Categorias com grid de M365CategoryCard (substituir por sections colapsaveis)
- Tabs Problemas/Conformes (mover para dentro de cada CategorySection ou remover)

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/m365/M365PostureReportPage.tsx` | Refatorar layout completo |
| `src/components/m365/posture/M365CategorySection.tsx` | Criar (novo) - secao colapsavel |
| `src/components/m365/posture/index.ts` | Exportar novo componente |

## Detalhes Tecnicos

### 1. Command Center Header

Adicionar ao `M365PostureReportPage.tsx` o mesmo container usado em Firewall/ExternalDomain:

```tsx
// Container com gradiente escuro e grid pattern
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
      backgroundImage: `...`,
      backgroundSize: "32px 32px"
    }}
  />
  
  <div className="relative p-8">
    {/* Identification Strip */}
    <div className="text-center mb-8">
      <h2 className="text-2xl md:text-3xl font-bold tracking-[0.2em] text-foreground uppercase">
        {displayInfo.tenant_name}
      </h2>
      <div className="h-0.5 w-48 mx-auto mt-3 bg-gradient-to-r from-transparent via-primary to-transparent" />
    </div>

    {/* Two-Column Layout */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
      {/* Left: M365ScoreGauge + MiniStats */}
      {/* Right: DetailRows com info do tenant e severidades */}
    </div>
  </div>
</div>
```

### 2. Painel Esquerdo (Score + Stats)

```tsx
<div className="flex flex-col items-center justify-center">
  <div className="relative">
    <div 
      className="absolute inset-0 blur-3xl opacity-20"
      style={{ background: "radial-gradient(circle, hsl(175 80% 45%), transparent 70%)" }}
    />
    {/* MANTER o M365ScoreGauge atual */}
    <M365ScoreGauge score={reportData.score} classification={reportData.classification} size="lg" />
  </div>

  {/* MiniStats inline */}
  <div className="flex gap-3 mt-6">
    <MiniStat value={totalChecks} label="Total" variant="primary" />
    <MiniStat value={passedCount} label="Aprovadas" variant="success" />
    <MiniStat value={failedCount} label="Falhas" variant="destructive" />
  </div>
</div>
```

### 3. Painel Direito (Detalhes + Severidades)

```tsx
<div className="flex flex-col justify-center lg:border-l lg:border-border/30 lg:pl-8">
  <DetailRow label="Workspace" value={displayInfo.client_name || 'N/A'} />
  <DetailRow label="Dominio" value={displayInfo.tenant_domain || 'N/A'} highlight />
  <DetailRow label="Data" value={format(new Date(reportData.created_at), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })} />
  <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent my-2" />
  {/* Severidades com indicadores visuais */}
  <DetailRow 
    label="Criticos" 
    value={`${summary.critical} ${summary.critical === 1 ? 'problema' : 'problemas'}`}
    indicator={summary.critical > 0 ? "error" : "success"}
  />
  <DetailRow 
    label="Alta" 
    value={`${summary.high} ${summary.high === 1 ? 'problema' : 'problemas'}`}
    indicator={summary.high > 0 ? "error" : "success"}
  />
  <DetailRow label="Media" value={`${summary.medium}`} />
  <DetailRow label="Baixa" value={`${summary.low}`} />
</div>
```

### 4. Novo Componente M365CategorySection

Criar `src/components/m365/posture/M365CategorySection.tsx` baseado no `CategorySection.tsx`:

```tsx
interface M365CategorySectionProps {
  category: string; // Ex: "identities", "auth_access"
  label: string;    // Ex: "Identidades", "Autenticacao e Acesso"
  insights: M365Insight[];
  index: number;
}

// Cabecalho colapsavel com:
// - Icone e nome da categoria
// - Badge de contagem de verificacoes
// - Badges de severidade (criticos, altos)
// - Percentual de conformidade
// - Chevron expand/collapse

// Conteudo expandido:
// - Lista de M365InsightCard
```

### 5. Layout das Categorias

Substituir o grid atual de cards por sections colapsaveis:

```tsx
<div className="space-y-4">
  <h2 className="text-xl font-semibold text-foreground mb-4">
    Verificacoes por Categoria
  </h2>
  {categories.map((cat, index) => (
    <M365CategorySection
      key={cat.category}
      category={cat.category}
      label={CATEGORY_LABELS[cat.category]}
      insights={insights.filter(i => i.category === cat.category)}
      index={index}
    />
  ))}
</div>
```

## Componentes Inline a Adicionar

Os componentes `MiniStat` e `DetailRow` serao adicionados inline no arquivo (mesmo padrao do Dashboard.tsx e ExternalDomainAnalysisReportPage.tsx).

## Resultado Esperado

- Header Command Center identico ao de Firewall/External Domain
- Gauge M365 mantido (estilo escuro com shadow)
- Informacoes do tenant organizadas em DetailRows
- Severidades visiveis no painel direito
- Categorias em sections colapsaveis (nao mais cards em grid)
- Insights agrupados dentro de cada categoria
- Banner de alertas criticos (padrao existente)
- Botoes PDF e Reanalisar no header (preparado para implementacao futura)
