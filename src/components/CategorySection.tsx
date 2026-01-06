import { ComplianceCategory } from '@/types/compliance';
import { ComplianceCard } from './ComplianceCard';
import { Shield, Network, Lock, Activity, Download, ChevronDown, ChevronUp, Monitor, ArrowDownToLine } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CategorySectionProps {
  category: ComplianceCategory;
  index: number;
}

const iconMap: Record<string, typeof Shield> = {
  shield: Shield,
  network: Network,
  lock: Lock,
  activity: Activity,
  download: Download,
  monitor: Monitor,
  arrowDownToLine: ArrowDownToLine,
};

export function CategorySection({ category, index }: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const Icon = iconMap[category.icon] || Shield;

  const getPassRateColor = () => {
    if (category.passRate >= 80) return 'text-success';
    if (category.passRate >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div 
      className="animate-slide-in"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 glass-card rounded-lg mb-3 hover:border-primary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground">{category.name}</h3>
            <p className="text-sm text-muted-foreground">
              {category.checks.length} verificações
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className={cn("text-2xl font-bold tabular-nums", getPassRateColor())}>
              {category.passRate}%
            </span>
            <p className="text-xs text-muted-foreground">aprovação</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-3 pl-4 border-l-2 border-primary/20 ml-6 mb-6">
          {category.checks.map((check) => (
            <ComplianceCard key={check.id} check={check} />
          ))}
        </div>
      )}
    </div>
  );
}
