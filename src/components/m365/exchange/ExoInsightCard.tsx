import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info,
  ChevronRight,
  Mail,
} from 'lucide-react';
import { ExchangeInsight, EXO_SEVERITY_CONFIG } from '@/types/exchangeInsights';
import { ExoInsightDetailDialog } from './ExoInsightDetailDialog';

interface ExoInsightCardProps {
  insight: ExchangeInsight;
}

const severityIcons = {
  critical: AlertTriangle,
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
  info: Info,
};

export function ExoInsightCard({ insight }: ExoInsightCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const severityConfig = EXO_SEVERITY_CONFIG[insight.severity];
  const SeverityIcon = severityIcons[insight.severity];

  return (
    <>
      <Card className={`glass-card border-l-4 ${severityConfig.borderColor} hover:shadow-md transition-shadow`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2 rounded-lg ${severityConfig.bgColor} shrink-0`}>
                <SeverityIcon className={`w-5 h-5 ${severityConfig.color}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${severityConfig.color} ${severityConfig.borderColor}`}
                  >
                    {severityConfig.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {insight.code}
                  </span>
                </div>
                
                <h4 className="font-medium text-foreground mb-1">
                  {insight.title}
                </h4>
                
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {insight.description}
                </p>

                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{insight.affectedCount} mailbox(es) afetada(s)</span>
                  </div>
                </div>
              </div>
            </div>

            <Button 
              variant="ghost" 
              size="sm" 
              className="shrink-0"
              onClick={() => setDialogOpen(true)}
            >
              Ver detalhes
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <ExoInsightDetailDialog 
        insight={insight}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
