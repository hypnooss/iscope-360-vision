import { Globe, Server, Network, Mail, Shield, ListChecks, CheckCircle2, ShieldX, AlertTriangle } from "lucide-react";
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
  stats: {
    total: 23,
    passed: 18,
    failed: 5,
    warnings: 0,
  },
};

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}

function InfoRow({ icon, label, value, highlight = false }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex-shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <span className="text-xs text-muted-foreground block">{label}</span>
        <span
          className={cn(
            "text-sm font-medium truncate block",
            highlight ? "text-primary" : "text-foreground"
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

export default function DomainReportPreview() {
  const { domain, score, soa, nameservers, soaContact, dnssec, stats } = mockData;

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Preview: Domain Report Header</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Este é um preview do novo layout (Opção 2 - Score Integrado). A página funcional não foi alterada.
        </p>
      </div>

      {/* Score Integrado - Card Único */}
      <div className="glass-card rounded-xl p-6 border border-primary/20 mb-6 max-w-5xl">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Score compacto à esquerda */}
          <div className="flex-shrink-0 flex items-center justify-center lg:justify-start">
            <ScoreGauge score={score} size={140} />
          </div>

          {/* Informações centrais */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              <InfoRow
                icon={<Globe className="w-4 h-4" />}
                label="Domínio"
                value={domain}
                highlight
              />
              <InfoRow
                icon={<Server className="w-4 h-4" />}
                label="SOA"
                value={soa}
              />
              <InfoRow
                icon={<Network className="w-4 h-4" />}
                label="Nameservers"
                value={nameservers.join(", ")}
              />
              <InfoRow
                icon={<Mail className="w-4 h-4" />}
                label="SOA Contact"
                value={soaContact}
              />
              <InfoRow
                icon={<Shield className="w-4 h-4" />}
                label="DNSSEC"
                value={dnssec ? "Ativo" : "Inativo"}
                highlight={dnssec}
              />
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
      <div className="max-w-5xl glass-card rounded-xl p-5 border border-border/50">
        <h2 className="text-lg font-semibold mb-3">Mudanças Aplicadas</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>✓ Score reduzido de 200px para 140px</li>
          <li>✓ Card único consolidando score + informações + stats</li>
          <li>✓ Espaçamento vertical aumentado (gap-y-3)</li>
          <li>✓ Espaçamento horizontal aumentado (gap-x-8)</li>
          <li>✓ Badge "DOMÍNIO" removido (redundante)</li>
          <li>✓ Stats integrados na parte inferior do card</li>
          <li>✓ Responsivo: empilha verticalmente em mobile</li>
        </ul>
      </div>
    </div>
  );
}
