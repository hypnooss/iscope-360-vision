/**
 * InsightCard — wrapper over UnifiedComplianceCard
 * Mantém o dialog de detalhes (InsightDetailDialog) para exibição de usuários afetados.
 */
import { useState } from 'react';
import { SecurityInsight } from '@/types/securityInsights';
import { UnifiedComplianceCard } from '@/components/compliance/UnifiedComplianceCard';
import { mapSecurityInsight } from '@/lib/complianceMappers';
import { InsightDetailDialog } from './InsightDetailDialog';

interface InsightCardProps {
  insight: SecurityInsight;
}

export function InsightCard({ insight }: InsightCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const item = mapSecurityInsight(insight);

  return (
    <>
      <UnifiedComplianceCard
        item={item}
        onShowAffectedEntities={() => setShowDetails(true)}
      />

      <InsightDetailDialog
        insight={insight}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  );
}
