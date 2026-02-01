
## Plano: Implantar Command Center Header no Relatório de Firewall

### Contexto

O relatório de **Domínios Externos** (`ExternalDomainAnalysisReportPage.tsx`) possui um header estilizado chamado "Command Center Header" que oferece uma apresentação visual superior. Este padrão deve ser replicado no relatório de **Análise de Compliance do Firewall** (`Dashboard.tsx` usado em `FirewallAnalysis.tsx`).

---

### Estrutura Atual do Firewall (Dashboard.tsx)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Título "Análise de Compliance" + Botões                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐   ┌──────────────────────────────────────┐ │
│  │  Score Gauge    │   │  Info Grid + Stats Cards              │ │
│  │  (glass-card)   │   │  (glass-card separado)               │ │
│  └─────────────────┘   └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Estrutura Alvo (Command Center Header)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Título + Botões                                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  COMMAND CENTER (dark gradient + grid pattern)              ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │           NOME DO FIREWALL (identification strip)     │  ││
│  │  │           ────────────────────────────────             │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  │  ┌──────────────────────┬─────────────────────────────────┐ ││
│  │  │  Score Gauge         │  Info Details (DetailRow)       │ ││
│  │  │  + MiniStats         │  - Modelo, Serial, Uptime       │ ││
│  │  │  (Total/Pass/Fail)   │  - Firmware, URL, Hostname      │ ││
│  │  └──────────────────────┴─────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

### Alterações em `src/components/Dashboard.tsx`

#### 1. Adicionar Componente MiniStat

Copiar o componente `MiniStat` do relatório de Domínios Externos:

```typescript
interface MiniStatProps {
  value: number;
  label: string;
  variant?: "default" | "primary" | "success" | "destructive";
}

function MiniStat({ value, label, variant = "default" }: MiniStatProps) {
  const variantStyles = {
    default: { text: "text-foreground", border: "border-border/30", bg: "bg-background/50" },
    primary: { text: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-500/10" },
    success: { text: "text-primary", border: "border-primary/30", bg: "bg-primary/10" },
    destructive: { text: "text-rose-400", border: "border-rose-500/30", bg: "bg-rose-500/10" }
  };
  const style = variantStyles[variant];

  return (
    <div className={cn("text-center px-4 py-2 rounded-lg border min-w-[100px]", style.bg, style.border)}>
      <span className={cn("text-xl font-bold tabular-nums block", style.text)}>{value}</span>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}
```

#### 2. Adicionar Componente DetailRow

Copiar o componente `DetailRow` para exibir informações estruturadas:

```typescript
interface DetailRowProps {
  label: string;
  value: string | string[];
  indicator?: "success" | "error";
  highlight?: boolean;
}

function DetailRow({ label, value, indicator, highlight }: DetailRowProps) {
  const isMultiline = Array.isArray(value);
  
  return (
    <div className="group">
      <div className="flex items-start gap-3 py-2">
        <span className="text-xs text-muted-foreground w-24 flex-shrink-0 uppercase tracking-wide pt-0.5">
          {label}
        </span>
        <div className="flex-1 min-w-0">
          {indicator && (
            <span className={cn(
              "inline-block w-2 h-2 rounded-full mr-2 mt-1.5",
              indicator === "success" 
                ? "bg-emerald-400 shadow-[0_0_6px_hsl(142_76%_60%/0.5)]" 
                : "bg-rose-400 shadow-[0_0_6px_hsl(0_72%_60%/0.5)]"
            )} />
          )}
          {isMultiline ? (
            <div className="space-y-0.5">
              {value.map((v, i) => (
                <div key={i} className={cn("text-sm font-medium", highlight ? "text-primary" : "text-foreground")}>
                  {v}
                </div>
              ))}
            </div>
          ) : (
            <span className={cn("text-sm font-medium", highlight ? "text-primary" : "text-foreground")}>
              {value}
            </span>
          )}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent" />
    </div>
  );
}
```

#### 3. Substituir Grid de Score + Info pelo Command Center Header

Substituir o bloco atual (linhas 97-196) pelo novo layout:

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
          {firewallName || 'Firewall'}
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

        {/* Right Panel: Firewall Details */}
        <div className="flex flex-col justify-center lg:border-l lg:border-border/30 lg:pl-8">
          <DetailRow label="Modelo" value={report.systemInfo?.model || 'N/A'} />
          <DetailRow label="Serial" value={report.systemInfo?.serial || 'N/A'} />
          <DetailRow label="Firmware" value={report.firmwareVersion ? `v${report.firmwareVersion}` : 'N/A'} />
          <DetailRow label="Hostname" value={report.systemInfo?.hostname || firewallName || 'N/A'} />
          <DetailRow label="Uptime" value={report.systemInfo?.uptime || 'N/A'} />
          <DetailRow label="URL" value={firewallUrl || 'N/A'} />
        </div>
      </div>
    </div>
  </div>
</div>
```

#### 4. Remover StatCards Antigos e Info Grid

Remover completamente o bloco de `glass-card` com `StatCard` compactos, pois os `MiniStat` dentro do Command Center substituem essa funcionalidade.

#### 5. Adicionar Import do `cn`

Garantir que `cn` esteja importado de `@/lib/utils`.

---

### Resumo das Alterações

| Item | Descrição |
|------|-----------|
| Componentes | Adicionar `MiniStat` e `DetailRow` |
| Layout | Substituir grid de cards por Command Center Header |
| Visual | Fundo gradiente escuro + grid pattern + glow no gauge |
| Dados | Mostrar Modelo, Serial, Firmware, Hostname, Uptime, URL |

---

### Resultado Final

O relatório de Firewall terá:
- Faixa de identificação centralizada com nome do firewall em caixa alta
- Score Gauge com brilho radial (glow)
- MiniStats compactos (Total/Aprovadas/Falhas) abaixo do gauge
- Painel de detalhes à direita com linhas estruturadas e divisores gradiente
- Paridade visual completa com o relatório de Domínios Externos
