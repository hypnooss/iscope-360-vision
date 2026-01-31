import { ScoreGauge } from "@/components/ScoreGauge";
import { cn } from "@/lib/utils";

// Mock data for preview
const mockData = {
  domain: "brinquedosestrela.com.br",
  score: 79,
  soa: "e.sec.dns.br",
  nameservers: ["e.sec.dns.br", "f.sec.dns.br"],
  soaContact: "hostmaster@registro.br",
  dnssec: true,
  stats: {
    total: 23,
    passed: 18,
    failed: 5,
  },
  emailAuth: {
    spf: true,
    dkim: true,
    dmarc: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MiniStat: Ultra-compact stat display
// ─────────────────────────────────────────────────────────────────────────────

interface MiniStatProps {
  value: number;
  label: string;
  variant?: "default" | "primary" | "success" | "destructive";
}

function MiniStat({ value, label, variant = "default" }: MiniStatProps) {
  const variantStyles = {
    default: {
      text: "text-foreground",
      border: "border-border/30",
      bg: "bg-background/50"
    },
    primary: {
      text: "text-primary",
      border: "border-primary/30",
      bg: "bg-primary/10"
    },
    success: {
      text: "text-sky-400",
      border: "border-sky-500/30",
      bg: "bg-sky-500/10"
    },
    destructive: {
      text: "text-rose-400",
      border: "border-rose-500/30",
      bg: "bg-rose-500/10"
    }
  };

  const style = variantStyles[variant];

  return (
    <div className={cn(
      "text-center px-4 py-2 rounded-lg border",
      style.bg,
      style.border
    )}>
      <span className={cn("text-xl font-bold tabular-nums block", style.text)}>
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetailRow: Structured info row with label and value
// ─────────────────────────────────────────────────────────────────────────────

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
            <span 
              className={cn(
                "inline-block w-2 h-2 rounded-full mr-2 mt-1.5",
                indicator === "success" ? "bg-emerald-400 shadow-[0_0_6px_hsl(142_76%_60%/0.5)]" : "bg-rose-400 shadow-[0_0_6px_hsl(0_72%_60%/0.5)]"
              )} 
            />
          )}
          {isMultiline ? (
            <div className="space-y-0.5">
              {value.map((v, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "text-sm font-medium",
                    highlight ? "text-primary" : "text-foreground"
                  )}
                >
                  {v}
                </div>
              ))}
            </div>
          ) : (
            <span 
              className={cn(
                "text-sm font-medium",
                highlight ? "text-primary" : "text-foreground",
                indicator && "inline-flex items-center"
              )}
            >
              {value}
            </span>
          )}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function DomainReportPreview() {
  const { domain, score, soa, nameservers, soaContact, dnssec, stats, emailAuth } = mockData;

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Command Center Header</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Novo design universal para headers de relatório
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          COMMAND CENTER HEADER
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl">
        <div 
          className="relative overflow-hidden rounded-2xl border border-primary/20"
          style={{
            background: "linear-gradient(145deg, hsl(220 18% 11%), hsl(220 18% 8%))",
            boxShadow: "0 0 60px hsl(175 80% 45% / 0.08), 0 4px 24px hsl(220 20% 0% / 0.4)"
          }}
        >
          {/* Subtle grid pattern overlay */}
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
            {/* ─── Identification Strip ─── */}
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold tracking-[0.2em] text-foreground uppercase">
                {domain}
              </h2>
              <div className="h-0.5 w-48 mx-auto mt-3 bg-gradient-to-r from-transparent via-primary to-transparent" />
            </div>

            {/* ─── Two-Column Layout ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              
              {/* Left Panel: Score + Stats */}
              <div className="flex flex-col items-center justify-center">
                {/* Score Gauge - Dominant */}
                <div className="relative">
                  <div 
                    className="absolute inset-0 blur-3xl opacity-20"
                    style={{ background: "radial-gradient(circle, hsl(175 80% 45%), transparent 70%)" }}
                  />
                  <ScoreGauge score={score} size={180} />
                </div>

                {/* Mini Stats Row */}
                <div className="flex gap-3 mt-6">
                  <MiniStat value={stats.total} label="Total" variant="primary" />
                  <MiniStat value={stats.passed} label="Aprovadas" variant="success" />
                  <MiniStat value={stats.failed} label="Falhas" variant="destructive" />
                </div>
              </div>

              {/* Right Panel: Details */}
              <div className="flex flex-col justify-center lg:border-l lg:border-border/30 lg:pl-8">
                <DetailRow label="SOA Primary" value={soa} />
                <DetailRow label="Nameservers" value={nameservers} />
                <DetailRow label="Contato SOA" value={soaContact} />
                <DetailRow 
                  label="DNSSEC" 
                  value={dnssec ? "Ativo" : "Inativo"} 
                  indicator={dnssec ? "success" : "error"}
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

      {/* Design Notes */}
      <div className="max-w-5xl mt-8 glass-card rounded-xl p-6 border border-border/50">
        <h2 className="text-lg font-semibold mb-4">Características do Design</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
          <ul className="space-y-2">
            <li>✓ Título com tracking-[0.2em] para visual tech</li>
            <li>✓ Underline gradiente centralizado</li>
            <li>✓ Gauge 180px com glow radial sutil</li>
            <li>✓ MiniStats compactos com background sutil</li>
          </ul>
          <ul className="space-y-2">
            <li>✓ DetailRows com separadores gradiente</li>
            <li>✓ Indicadores com glow colorido (DNSSEC)</li>
            <li>✓ Grid pattern de fundo para profundidade</li>
            <li>✓ Layout responsivo (empilha em mobile)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
