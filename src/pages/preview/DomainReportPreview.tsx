import { ListChecks, CheckCircle2, ShieldX, AlertTriangle } from "lucide-react";
import { ScoreGauge } from "@/components/ScoreGauge";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";

// Mock data for preview
const mockData = {
  domain: "brinquedosestrela.com.br",
  score: 79,
  soa: "e.sec.dns.br",
  nameservers: ["e.sec.dns.br", "f.sec.dns.br"],
  soaContact: "hostmaster@registro.br",
  dnssec: true,
  clientName: "Brinquedos Estrela S/A",
  stats: {
    total: 23,
    passed: 18,
    failed: 5,
    warnings: 0,
  },
};

interface InfoTableRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  status?: boolean;
}

function InfoTableRow({ label, value, highlight, status }: InfoTableRowProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground w-32 flex-shrink-0">
        {label}
      </span>
      <span className="h-px flex-1 bg-border/30 max-w-[60px]" />
      <span
        className={cn(
          "text-sm font-medium flex-1 truncate",
          highlight && "text-primary font-semibold",
          status === true && "text-emerald-500",
          status === false && "text-destructive"
        )}
      >
        {value || "N/A"}
      </span>
    </div>
  );
}

export default function DomainReportPreview() {
  const { domain, score, soa, nameservers, soaContact, dnssec, clientName, stats } = mockData;

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Preview: Domain Report Header</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Layout tabular com Score à esquerda e informações estruturadas à direita.
        </p>
      </div>

      {/* Score Integrado - Card Único com Layout Tabular */}
      <div className="glass-card rounded-xl p-6 border border-primary/20 mb-6 max-w-4xl">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Score à esquerda - tamanho maior para legibilidade */}
          <div className="flex-shrink-0 flex items-center justify-center lg:justify-start">
            <ScoreGauge score={score} size={160} />
          </div>

          {/* Informações em formato tabular */}
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <div className="space-y-2.5">
              <InfoTableRow label="Domínio" value={domain} highlight />
              <InfoTableRow label="SOA" value={soa} />
              <InfoTableRow label="Nameservers" value={nameservers.join(", ")} />
              <InfoTableRow label="SOA Contact" value={soaContact} />
              <InfoTableRow 
                label="DNSSEC Status" 
                value={dnssec ? "Ativo" : "Inativo"} 
                status={dnssec} 
              />
              <InfoTableRow label="Workspace" value={clientName} />
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className="border-t border-border/50 my-5" />

        {/* Stats horizontais */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            title="Total"
            value={stats.total}
            icon={ListChecks}
            variant="default"
            compact
          />
          <StatCard
            title="Aprovadas"
            value={stats.passed}
            icon={CheckCircle2}
            variant="success"
            compact
          />
          <StatCard
            title="Falhas"
            value={stats.failed}
            icon={ShieldX}
            variant="destructive"
            compact
          />
          <StatCard
            title="Alertas"
            value={stats.warnings}
            icon={AlertTriangle}
            variant="warning"
            compact
          />
        </div>
      </div>

      {/* Notas de Design */}
      <div className="max-w-4xl glass-card rounded-xl p-5 border border-border/50">
        <h2 className="text-lg font-semibold mb-3">Mudanças Aplicadas (v2)</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>✓ Score aumentado para 160px (melhor legibilidade)</li>
          <li>✓ Layout tabular com labels fixos (w-32 = 128px)</li>
          <li>✓ Lista vertical de 6 itens organizada</li>
          <li>✓ Separador visual entre label e valor</li>
          <li>✓ Espaçamento vertical aumentado (space-y-2.5)</li>
          <li>✓ Gap horizontal aumentado (gap-8)</li>
          <li>✓ Campo "Workspace" adicionado</li>
          <li>✓ DNSSEC com cor verde/vermelho baseado no status</li>
        </ul>
      </div>
    </div>
  );
}
