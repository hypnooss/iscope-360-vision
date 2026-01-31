import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  ChevronDown, 
  Package,
  Key,
  ShieldAlert,
  ClipboardCheck,
} from 'lucide-react';
import { ApplicationInsight, APP_SEVERITY_CONFIG, AppInsightCategory } from '@/types/applicationInsights';
import { AppInsightDetailDialog } from './AppInsightDetailDialog';

interface AppInsightCardProps {
  insight: ApplicationInsight;
}

const CATEGORY_ICONS: Record<AppInsightCategory, React.ElementType> = {
  credential_expiration: Key,
  privileged_permissions: ShieldAlert,
  security_hygiene: ClipboardCheck,
};

const SEVERITY_ICONS = {
  critical: AlertTriangle,
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
  info: Info,
};

export function AppInsightCard({ insight }: AppInsightCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const severityConfig = APP_SEVERITY_CONFIG[insight.severity];
  const SeverityIcon = SEVERITY_ICONS[insight.severity];
  const CategoryIcon = CATEGORY_ICONS[insight.category];

  return (
    <>
      <Card className={`glass-card border-l-4 ${severityConfig.borderColor} hover:shadow-md transition-shadow`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${severityConfig.bgColor}`}>
                <SeverityIcon className={`w-5 h-5 ${severityConfig.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge 
                    variant="outline" 
                    className={`${severityConfig.bgColor} ${severityConfig.color} border-0 text-xs font-medium`}
                  >
                    {severityConfig.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{insight.code}</span>
                </div>
                <h4 className="font-semibold text-foreground leading-tight">
                  {insight.title}
                </h4>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Package className="w-4 h-4" />
                <span className="text-sm font-medium">{insight.affectedCount}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {insight.description}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CategoryIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {insight.affectedCount} aplicativo{insight.affectedCount !== 1 ? 's' : ''} afetado{insight.affectedCount !== 1 ? 's' : ''}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowDetails(true)}
              className="gap-1.5"
            >
              Ver detalhes
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <AppInsightDetailDialog 
        insight={insight} 
        open={showDetails} 
        onOpenChange={setShowDetails} 
      />
    </>
  );
}
