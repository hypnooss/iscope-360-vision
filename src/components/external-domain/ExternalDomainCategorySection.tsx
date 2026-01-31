import { useState } from 'react';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, ShieldCheck, KeyRound, ShieldAlert, Globe, Mail, Shield } from 'lucide-react';
import { ComplianceCategory } from '@/types/compliance';
import { ComplianceCard } from '@/components/ComplianceCard';

interface ExternalDomainCategorySectionProps {
  category: ComplianceCategory;
  index: number;
  defaultOpen?: boolean;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Autenticação de Email - SPF': { 
    bg: 'bg-blue-500/10', 
    text: 'text-blue-500', 
    border: 'border-blue-500/30' 
  },
  'Autenticação de Email - DKIM': { 
    bg: 'bg-cyan-500/10', 
    text: 'text-cyan-500', 
    border: 'border-cyan-500/30' 
  },
  'Autenticação de Email - DMARC': { 
    bg: 'bg-indigo-500/10', 
    text: 'text-indigo-500', 
    border: 'border-indigo-500/30' 
  },
  'Segurança DNS': { 
    bg: 'bg-emerald-500/10', 
    text: 'text-emerald-500', 
    border: 'border-emerald-500/30' 
  },
  'Infraestrutura de Email': { 
    bg: 'bg-violet-500/10', 
    text: 'text-violet-500', 
    border: 'border-violet-500/30' 
  },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Autenticação de Email - SPF': ShieldCheck,
  'Autenticação de Email - DKIM': KeyRound,
  'Autenticação de Email - DMARC': ShieldAlert,
  'Segurança DNS': Globe,
  'Infraestrutura de Email': Mail,
};

// Fallback colors for categories not in the map
const DEFAULT_COLORS = { 
  bg: 'bg-slate-500/10', 
  text: 'text-slate-500', 
  border: 'border-slate-500/30' 
};

export function ExternalDomainCategorySection({ 
  category, 
  index,
  defaultOpen = true 
}: ExternalDomainCategorySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const colors = CATEGORY_COLORS[category.name] || DEFAULT_COLORS;
  const Icon = CATEGORY_ICONS[category.name] || Shield;

  // Count critical and high severity failures
  const criticalHighCount = category.checks.filter(
    c => c.status === 'fail' && (c.severity === 'critical' || c.severity === 'high')
  ).length;

  // Get pass rate color based on percentage
  const getPassRateColor = (passRate: number) => {
    if (passRate >= 80) return 'text-emerald-500';
    if (passRate >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  if (category.checks.length === 0) return null;

  return (
    <div 
      className="animate-slide-in"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={`w-full justify-between h-auto py-4 px-4 ${colors.bg} hover:${colors.bg} border ${colors.border} rounded-lg`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${colors.bg}`}>
                <Icon className={`w-5 h-5 ${colors.text}`} />
              </div>
              <span className="font-semibold text-foreground">{category.name}</span>
              <Badge variant="secondary" className="text-xs">
                {category.checks.length} verificaç{category.checks.length !== 1 ? 'ões' : 'ão'}
              </Badge>
              {criticalHighCount > 0 && (
                <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
                  {criticalHighCount} crítico{criticalHighCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className={`text-2xl font-bold tabular-nums ${getPassRateColor(category.passRate)}`}>
                  {category.passRate}%
                </span>
                <p className="text-xs text-muted-foreground">aprovação</p>
              </div>
              {isOpen ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className={`pt-4 space-y-3 pl-4 border-l-2 ml-6 mb-6 ${colors.border}`}>
          {category.checks.map((check) => (
            <ComplianceCard key={check.id} check={check} variant="external_domain" />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
