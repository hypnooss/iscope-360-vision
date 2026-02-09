/**
 * ExoInsightCard — wrapper over UnifiedComplianceCard
 * Mantém o dialog de detalhes (ExoInsightDetailDialog) para exibição de mailboxes afetadas.
 */
import { useState } from 'react';
import { ExchangeInsight } from '@/types/exchangeInsights';
import { UnifiedComplianceCard } from '@/components/compliance/UnifiedComplianceCard';
import { mapExchangeInsight } from '@/lib/complianceMappers';
import { ExoInsightDetailDialog } from './ExoInsightDetailDialog';

interface ExoInsightCardProps {
  insight: ExchangeInsight;
}

export function ExoInsightCard({ insight }: ExoInsightCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const item = mapExchangeInsight(insight);

  return (
    <>
      <UnifiedComplianceCard
        item={item}
        onShowAffectedEntities={() => setShowDetails(true)}
      />

      <ExoInsightDetailDialog
        insight={insight}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  );
}
