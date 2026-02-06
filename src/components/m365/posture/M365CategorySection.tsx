import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { M365Insight, CATEGORY_ICONS, CATEGORY_COLORS } from '@/types/m365Insights';
import { M365InsightCard } from './M365InsightCard';

interface M365CategorySectionProps {
  category: string;
  label: string;
  insights: M365Insight[];
  index: number;
}

// Dynamic icon component
function DynamicIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const iconName = name as keyof typeof LucideIcons;
  const IconComponent = LucideIcons[iconName] as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  
  if (!IconComponent) {
    return <LucideIcons.Shield className={className} style={style} />;
  }
  
  return <IconComponent className={className} style={style} />;
}

// Color hex mapping for categories
const CATEGORY_COLOR_HEX: Record<string, string> = {
  blue: '#3b82f6',
  purple: '#a855f7',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  indigo: '#6366f1',
  red: '#ef4444',
  green: '#22c55e',
  orange: '#f97316',
  teal: '#14b8a6',
  violet: '#8b5cf6',
  rose: '#f43f5e',
};

export function M365CategorySection({ category, label, insights, index }: M365CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (insights.length === 0) return null;

  const iconName = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || 'Shield';
  const colorName = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || 'blue';
  const colorHex = CATEGORY_COLOR_HEX[colorName] || '#3b82f6';

  // Count by status and severity
  const failedInsights = insights.filter(i => i.status === 'fail');
  const passedInsights = insights.filter(i => i.status === 'pass');
  const criticalCount = failedInsights.filter(i => i.severity === 'critical').length;
  const highCount = failedInsights.filter(i => i.severity === 'high').length;
  const mediumCount = failedInsights.filter(i => i.severity === 'medium').length;
  const lowCount = failedInsights.filter(i => i.severity === 'low').length;

  // Calculate pass rate
  const passRate = insights.length > 0 
    ? Math.round((passedInsights.length / insights.length) * 100) 
    : 0;

  const getPassRateColor = () => {
    if (passRate >= 80) return 'text-primary';
    if (passRate >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div 
      className="animate-slide-in mb-6"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 rounded-lg mb-3 transition-colors"
        style={{
          backgroundColor: `${colorHex}10`,
          borderColor: `${colorHex}30`,
          borderWidth: '1px',
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${colorHex}15` }}
          >
            <DynamicIcon 
              name={iconName} 
              className="w-5 h-5" 
              style={{ color: colorHex }}
            />
          </div>
          <span className="text-base font-semibold text-foreground">{label}</span>
          <Badge variant="secondary" className="text-xs">
            {insights.length} verificaç{insights.length !== 1 ? 'ões' : 'ão'}
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
          <span className={cn("text-lg font-semibold tabular-nums", getPassRateColor())}>
            {passRate}%
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div 
          className="space-y-3 pl-4 ml-6 mb-6"
          style={{ 
            borderLeftWidth: '2px',
            borderLeftColor: `${colorHex}30`,
          }}
        >
          {/* Show failed insights first, then passed */}
          {failedInsights.map((insight) => (
            <M365InsightCard key={insight.id} insight={insight} />
          ))}
          {passedInsights.map((insight) => (
            <M365InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
