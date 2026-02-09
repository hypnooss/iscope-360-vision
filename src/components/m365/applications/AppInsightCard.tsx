/**
 * AppInsightCard — wrapper over UnifiedComplianceCard
 * Mantém o dialog de detalhes (AppInsightDetailDialog) para exibição de aplicativos afetados.
 */
import { useState } from 'react';
import { ApplicationInsight } from '@/types/applicationInsights';
import { UnifiedComplianceCard } from '@/components/compliance/UnifiedComplianceCard';
import { mapApplicationInsight } from '@/lib/complianceMappers';
import { AppInsightDetailDialog } from './AppInsightDetailDialog';

interface AppInsightCardProps {
  insight: ApplicationInsight;
}

export function AppInsightCard({ insight }: AppInsightCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const item = mapApplicationInsight(insight);

  return (
    <>
      <UnifiedComplianceCard
        item={item}
        onShowAffectedEntities={() => setShowDetails(true)}
      />

      <AppInsightDetailDialog
        insight={insight}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  );
}
