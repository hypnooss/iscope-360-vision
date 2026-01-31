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
  'Segurança DNS': { 
    bg: 'bg-cyan-400/10', 
    text: 'text-cyan-400', 
    border: 'border-cyan-400/30' 
  },
  'Infraestrutura de Email': { 
    bg: 'bg-violet-400/10', 
    text: 'text-violet-400', 
    border: 'border-violet-400/30' 
  },
  'Autenticação de Email - SPF': { 
    bg: 'bg-emerald-400/10', 
    text: 'text-emerald-400', 
    border: 'border-emerald-400/30' 
  },
  'Autenticação de Email - DKIM': { 
    bg: 'bg-pink-400/10', 
    text: 'text-pink-400', 
    border: 'border-pink-400/30' 
  },
  'Autenticação de Email - DMARC': { 
    bg: 'bg-amber-400/10', 
    text: 'text-amber-400', 
    border: 'border-amber-400/30' 
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

  // Count failures by severity (only active/failing items)
  const criticalCount = category.checks.filter(
    c => c.status === 'fail' && c.severity === 'critical'
  ).length;

  const highCount = category.checks.filter(
    c => c.status === 'fail' && c.severity === 'high'
  ).length;

  const mediumCount = category.checks.filter(
    c => c.status === 'fail' && c.severity === 'medium'
  ).length;

  const lowCount = category.checks.filter(
    c => c.status === 'fail' && c.severity === 'low'
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
              {criticalCount > 0 && (
                <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
                  {criticalCount} crítico{criticalCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {highCount > 0 && (
                <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">
                  {highCount} alto{highCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {mediumCount > 0 && (
                <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
                  {mediumCount} médio{mediumCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {lowCount > 0 && (
                <Badge className="bg-blue-400/10 text-blue-400 border-blue-400/20 text-xs">
                  {lowCount} baixo{lowCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className={`text-lg font-semibold tabular-nums ${getPassRateColor(category.passRate)}`}>
                {category.passRate}%
              </span>
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
            <ComplianceCard 
              key={check.id} 
              check={check} 
              variant="external_domain" 
              categoryColorKey={colors.text.replace('text-', '')}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
