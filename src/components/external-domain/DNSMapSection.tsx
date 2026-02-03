import React, { useState, useMemo } from 'react';
import { 
  Globe, 
  Server, 
  Mail, 
  FileText, 
  Shield, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  ExternalLink,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ComplianceCategory, ComplianceReport, SubdomainSummary } from '@/types/compliance';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DNSMapSectionProps {
  domain: string;
  dnsSummary?: ComplianceReport['dnsSummary'];
  subdomainSummary?: SubdomainSummary;
  categories: ComplianceCategory[];
  emailAuth: { spf: boolean; dkim: boolean; dmarc: boolean };
  className?: string;
}

interface MxRecord {
  exchange: string;
  priority: number;
  ips: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const extractMxRecords = (categories: ComplianceCategory[]): MxRecord[] => {
  const allChecks = categories.flatMap(c => c.checks);
  const mxCheck = allChecks.find((ch: any) => ch.rawData?.step_id === 'mx_records');
  const records = (mxCheck?.rawData as any)?.data?.records || [];
  
  return records.map((r: any) => ({
    exchange: r.exchange || r.host || 'Unknown',
    priority: r.priority || 0,
    ips: r.resolved_ips || [],
  }));
};

const truncateHostname = (hostname: string, maxLen = 25): string => {
  if (hostname.length <= maxLen) return hostname;
  return hostname.substring(0, maxLen - 2) + '…';
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

interface DNSNodeProps {
  label: string;
  value?: string;
  sublabel?: string;
  isActive?: boolean;
  showCopy?: boolean;
  showExternalLink?: boolean;
  className?: string;
}

function DNSNode({ label, value, sublabel, isActive, showCopy, showExternalLink, className }: DNSNodeProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    const textToCopy = value || label;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  return (
    <div className={cn(
      "group relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
      "bg-background/50 hover:bg-muted/30 border-border/50",
      className
    )}>
      {isActive !== undefined && (
        <span 
          className={cn(
            "w-2 h-2 rounded-full flex-shrink-0",
            isActive 
              ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" 
              : "bg-muted-foreground/30"
          )}
          title={isActive ? "Ativo" : "Inativo"}
        />
      )}
      
      <div className="flex-1 min-w-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm font-mono text-foreground truncate block cursor-default">
                {truncateHostname(label)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="font-mono text-xs break-all">{label}</p>
              {value && <p className="text-xs text-muted-foreground mt-1">{value}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {sublabel && (
          <span className="text-[10px] text-muted-foreground truncate block">{sublabel}</span>
        )}
      </div>
      
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 flex-shrink-0">
        {showCopy && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="w-3 h-3 text-primary" />
            ) : (
              <Copy className="w-3 h-3 text-muted-foreground" />
            )}
          </Button>
        )}
        {showExternalLink && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            asChild
          >
            <a
              href={`https://${label}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

interface DNSGroupProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  maxHeight?: string;
}

function DNSGroup({ title, count, icon, color, children, defaultExpanded = true, maxHeight = "300px" }: DNSGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="flex flex-col">
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
          "hover:bg-muted/30",
          color
        )}
      >
        <div className="p-1.5 rounded-md bg-background/50">
          {icon}
        </div>
        <span className="font-medium text-sm text-foreground">{title}</span>
        <Badge variant="secondary" className="ml-auto text-xs bg-background/50">
          {count}
        </Badge>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Connector Line */}
      <div className="flex justify-center h-3">
        <div className="w-px bg-border/50" />
      </div>

      {/* Items */}
      {isExpanded && (
        <div 
          className="space-y-1 overflow-y-auto scrollbar-thin"
          style={{ maxHeight }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function DNSMapSection({ 
  domain, 
  dnsSummary, 
  subdomainSummary, 
  categories, 
  emailAuth,
  className 
}: DNSMapSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const mxRecords = useMemo(() => extractMxRecords(categories), [categories]);
  
  // Filter subdomains by search
  const filteredSubdomains = useMemo(() => {
    if (!subdomainSummary?.subdomains) return [];
    if (!searchTerm.trim()) return subdomainSummary.subdomains;
    
    const term = searchTerm.toLowerCase();
    return subdomainSummary.subdomains.filter(
      (sub) =>
        sub.subdomain.toLowerCase().includes(term) ||
        sub.addresses.some((addr) => addr.ip.includes(term))
    );
  }, [subdomainSummary?.subdomains, searchTerm]);

  const activeCount = subdomainSummary?.subdomains.filter(s => s.is_alive).length ?? 0;
  const inactiveCount = subdomainSummary?.subdomains.filter(s => s.is_alive === false).length ?? 0;

  const nsRecords = dnsSummary?.ns || [];
  const dnssecActive = dnsSummary?.dnssecHasDnskey || dnsSummary?.dnssecHasDs;

  return (
    <Card className={cn("glass-card border-border/50", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <span className="text-foreground">Mapa de Infraestrutura DNS</span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Search (for subdomains) */}
        {subdomainSummary && subdomainSummary.total_found > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar subdomínio ou IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background/50"
            />
          </div>
        )}

        {/* Root Domain Node */}
        <div className="flex justify-center mb-4">
          <div className="px-6 py-3 rounded-xl border-2 border-primary/50 bg-primary/5 shadow-lg shadow-primary/10">
            <span className="text-lg font-bold text-foreground tracking-wide">{domain}</span>
          </div>
        </div>

        {/* Connector from root */}
        <div className="flex justify-center h-6">
          <div className="w-px bg-border" />
        </div>

        {/* Horizontal connector bar */}
        <div className="relative h-4 mx-8 mb-2">
          <div className="absolute inset-x-0 top-0 h-px bg-border" />
          {/* Vertical drops */}
          <div className="absolute left-[10%] top-0 w-px h-4 bg-border" />
          <div className="absolute left-[30%] top-0 w-px h-4 bg-border" />
          <div className="absolute left-[50%] top-0 w-px h-4 bg-border -translate-x-1/2" />
          <div className="absolute left-[70%] top-0 w-px h-4 bg-border" />
          <div className="absolute left-[90%] top-0 w-px h-4 bg-border" />
        </div>

        {/* DNS Groups Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* NS Records */}
          <DNSGroup
            title="NS"
            count={nsRecords.length}
            icon={<Server className="w-4 h-4 text-sky-400" />}
            color="border-sky-500/30 bg-sky-500/5"
            defaultExpanded={true}
          >
            {nsRecords.length > 0 ? (
              nsRecords.map((ns, idx) => (
                <DNSNode 
                  key={idx} 
                  label={ns} 
                  showCopy 
                />
              ))
            ) : (
              <div className="text-xs text-muted-foreground text-center py-2">
                Nenhum NS encontrado
              </div>
            )}
          </DNSGroup>

          {/* MX Records */}
          <DNSGroup
            title="MX"
            count={mxRecords.length}
            icon={<Mail className="w-4 h-4 text-purple-400" />}
            color="border-purple-500/30 bg-purple-500/5"
            defaultExpanded={true}
          >
            {mxRecords.length > 0 ? (
              mxRecords.map((mx, idx) => (
                <DNSNode 
                  key={idx} 
                  label={mx.exchange}
                  sublabel={`Prioridade: ${mx.priority}${mx.ips.length ? ` • ${mx.ips.slice(0, 2).join(', ')}` : ''}`}
                  showCopy 
                />
              ))
            ) : (
              <div className="text-xs text-muted-foreground text-center py-2">
                Nenhum MX encontrado
              </div>
            )}
          </DNSGroup>

          {/* SOA / DNSSEC */}
          <DNSGroup
            title="SOA"
            count={1}
            icon={<Shield className="w-4 h-4 text-amber-400" />}
            color="border-amber-500/30 bg-amber-500/5"
            defaultExpanded={true}
          >
            <div className="space-y-2 px-1">
              <div className="text-xs">
                <span className="text-muted-foreground">Primary:</span>
                <span className="ml-2 font-mono text-foreground truncate block">
                  {dnsSummary?.soaMname || 'N/A'}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Contact:</span>
                <span className="ml-2 font-mono text-foreground truncate block">
                  {dnsSummary?.soaContact || 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs pt-1 border-t border-border/30">
                <span 
                  className={cn(
                    "w-2 h-2 rounded-full",
                    dnssecActive 
                      ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" 
                      : "bg-muted-foreground/30"
                  )}
                />
                <span className="text-muted-foreground">DNSSEC:</span>
                <span className={cn(
                  "font-medium",
                  dnssecActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {dnssecActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </DNSGroup>

          {/* TXT (Email Auth) */}
          <DNSGroup
            title="TXT"
            count={3}
            icon={<FileText className="w-4 h-4 text-emerald-400" />}
            color="border-emerald-500/30 bg-emerald-500/5"
            defaultExpanded={true}
          >
            <div className="space-y-1.5 px-1">
              {[
                { name: 'SPF', valid: emailAuth.spf },
                { name: 'DKIM', valid: emailAuth.dkim },
                { name: 'DMARC', valid: emailAuth.dmarc },
              ].map((record) => (
                <div key={record.name} className="flex items-center gap-2 text-xs py-1">
                  <span 
                    className={cn(
                      "w-2 h-2 rounded-full",
                      record.valid 
                        ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" 
                        : "bg-rose-400 shadow-[0_0_6px_hsl(0_72%_60%/0.5)]"
                    )}
                  />
                  <span className="text-muted-foreground w-12">{record.name}</span>
                  <span className={cn(
                    "font-medium",
                    record.valid ? "text-primary" : "text-rose-400"
                  )}>
                    {record.valid ? '✓ Válido' : '✗ Ausente'}
                  </span>
                </div>
              ))}
            </div>
          </DNSGroup>

          {/* Subdomains */}
          <DNSGroup
            title="Subdomínios"
            count={subdomainSummary?.total_found ?? 0}
            icon={<Globe className="w-4 h-4 text-teal-400" />}
            color="border-teal-500/30 bg-teal-500/5"
            defaultExpanded={true}
            maxHeight="400px"
          >
            {/* Stats */}
            {subdomainSummary && subdomainSummary.total_found > 0 && (
              <div className="flex gap-2 mb-2 px-1">
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  {activeCount} ativos
                </Badge>
                <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">
                  {inactiveCount} inativos
                </Badge>
              </div>
            )}
            
            {filteredSubdomains.length > 0 ? (
              filteredSubdomains.slice(0, 50).map((sub, idx) => (
                <DNSNode 
                  key={idx} 
                  label={sub.subdomain}
                  sublabel={sub.addresses.length > 0 
                    ? sub.addresses.slice(0, 2).map(a => a.ip).join(', ')
                    : undefined
                  }
                  isActive={sub.is_alive}
                  showCopy 
                  showExternalLink={sub.is_alive}
                />
              ))
            ) : (
              <div className="text-xs text-muted-foreground text-center py-2">
                {searchTerm ? 'Nenhum resultado' : 'Nenhum subdomínio encontrado'}
              </div>
            )}
            
            {filteredSubdomains.length > 50 && (
              <div className="text-xs text-muted-foreground text-center py-2 border-t border-border/30 mt-2">
                +{filteredSubdomains.length - 50} subdomínios (use a busca para filtrar)
              </div>
            )}
          </DNSGroup>
        </div>

        {/* Sources Footer */}
        {subdomainSummary && subdomainSummary.sources.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border/30">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Fontes de enumeração:</span>{' '}
              {subdomainSummary.sources.slice(0, 6).join(', ')}
              {subdomainSummary.sources.length > 6 && ` (+${subdomainSummary.sources.length - 6})`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
