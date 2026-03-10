import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Eye, Lock, UserPlus, Hash, Share, Globe, Share2, FolderX,
} from 'lucide-react';
import type { CollaborationDashboardData } from '@/hooks/useCollaborationDashboard';
import type { TeamsOperationalCategory } from './TeamsAnalyzerCategoryGrid';

interface TeamsCategorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: TeamsOperationalCategory | null;
  dashboardData: CollaborationDashboardData | null;
}

const CATEGORY_META: Record<TeamsOperationalCategory, {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  colorHex: string;
  description: string;
}> = {
  public_teams:     { label: 'Teams Públicas',           icon: Eye,      colorHex: '#ef4444', description: 'Teams com visibilidade pública que podem ser descobertas e acessadas por qualquer membro da organização.' },
  private_teams:    { label: 'Teams Privadas',           icon: Lock,     colorHex: '#14b8a6', description: 'Teams com acesso restrito que requerem convite para participação.' },
  guest_access:     { label: 'Convidados Externos',      icon: UserPlus, colorHex: '#f59e0b', description: 'Teams que possuem usuários convidados externos à organização.' },
  private_channels: { label: 'Canais Privados',          icon: Hash,     colorHex: '#8b5cf6', description: 'Canais privados dentro das Teams com acesso limitado a membros específicos.' },
  shared_channels:  { label: 'Canais Compartilhados',    icon: Share,    colorHex: '#f97316', description: 'Canais compartilhados entre diferentes Teams ou organizações externas.' },
  sharepoint_sites: { label: 'Sites SharePoint',         icon: Globe,    colorHex: '#3b82f6', description: 'Visão geral dos sites SharePoint Online associados ao tenant.' },
  external_sharing: { label: 'Compartilhamento Externo', icon: Share2,   colorHex: '#dc2626', description: 'Sites SharePoint com compartilhamento externo habilitado.' },
  inactive_sites:   { label: 'Sites Inativos',           icon: FolderX,  colorHex: '#6366f1', description: 'Sites SharePoint sem atividade recente que podem representar risco ou desperdício.' },
};

function MetricCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-secondary/30 p-3 rounded-lg">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-bold text-lg ${color || ''}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

export function TeamsCategorySheet({ open, onOpenChange, category, dashboardData }: TeamsCategorySheetProps) {
  if (!category) return null;

  const meta = CATEGORY_META[category];
  const IconComp = meta.icon;
  const teams = dashboardData?.teams;
  const sharepoint = dashboardData?.sharepoint;

  const renderContent = () => {
    if (!teams || !sharepoint) return <p className="text-xs text-muted-foreground py-2">Sem dados disponíveis</p>;

    const totalTeams = teams.total || 1;
    const totalSites = sharepoint.totalSites || 1;

    switch (category) {
      case 'public_teams':
        return (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Teams Públicas" value={teams.public} />
            <MetricCard label="% do Total" value={`${((teams.public / totalTeams) * 100).toFixed(1)}%`} />
            <MetricCard label="Total de Teams" value={teams.total} />
            <MetricCard label="Teams Privadas" value={teams.private} />
          </div>
        );
      case 'private_teams':
        return (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Teams Privadas" value={teams.private} />
            <MetricCard label="% do Total" value={`${((teams.private / totalTeams) * 100).toFixed(1)}%`} />
            <MetricCard label="Total de Teams" value={teams.total} />
          </div>
        );
      case 'guest_access':
        return (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Teams com Convidados" value={teams.withGuests} />
            <MetricCard label="% do Total" value={`${((teams.withGuests / totalTeams) * 100).toFixed(1)}%`} />
            <MetricCard label="Total de Teams" value={teams.total} />
          </div>
        );
      case 'private_channels':
        return (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Canais Privados" value={teams.privateChannels} />
            <MetricCard label="Total de Teams" value={teams.total} />
          </div>
        );
      case 'shared_channels':
        return (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Canais Compartilhados" value={teams.sharedChannels} />
            <MetricCard label="Total de Teams" value={teams.total} />
          </div>
        );
      case 'sharepoint_sites':
        return (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Total de Sites" value={sharepoint.totalSites} />
            <MetricCard label="Sites Ativos" value={sharepoint.activeSites} />
            <MetricCard label="Sites Inativos" value={sharepoint.inactiveSites} />
            <MetricCard label="Compartilhamento Externo" value={sharepoint.externalSharingEnabled} />
            <MetricCard label="Total de Listas" value={sharepoint.totalLists} />
          </div>
        );
      case 'external_sharing':
        return (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Sites com Compartilhamento Externo" value={sharepoint.externalSharingEnabled} />
            <MetricCard label="% do Total" value={`${((sharepoint.externalSharingEnabled / totalSites) * 100).toFixed(1)}%`} />
            <MetricCard label="Total de Sites" value={sharepoint.totalSites} />
          </div>
        );
      case 'inactive_sites':
        return (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Sites Inativos" value={sharepoint.inactiveSites} />
            <MetricCard label="% do Total" value={`${((sharepoint.inactiveSites / totalSites) * 100).toFixed(1)}%`} />
            <MetricCard label="Sites Ativos" value={sharepoint.activeSites} />
            <MetricCard label="Total de Sites" value={sharepoint.totalSites} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[50vw] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${meta.colorHex}15` }}>
              <IconComp className="w-5 h-5" style={{ color: meta.colorHex }} />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg">{meta.label}</SheetTitle>
              <SheetDescription className="text-xs mt-0.5">{meta.description}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {renderContent()}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
