import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, ShieldCheck, AlertTriangle, LogIn, UserCog, UserX, UserPlus, KeyRound, User,
  Cloud, RefreshCw, Eye,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import type { EntraIdDashboardData } from '@/hooks/useEntraIdDashboard';
import type { EntraIdOperationalCategory } from './EntraIdAnalyzerCategoryGrid';

interface EntraIdCategorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: EntraIdOperationalCategory | null;
  dashboardData: EntraIdDashboardData | null;
}

const CATEGORY_META: Record<EntraIdOperationalCategory, {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  colorHex: string;
  description: string;
}> = {
  active_users:      { label: 'Usuários Ativos',       icon: Users,         colorHex: '#14b8a6', description: 'Visão geral dos usuários ativos e desabilitados no diretório.' },
  mfa_coverage:      { label: 'Cobertura MFA',         icon: ShieldCheck,   colorHex: '#10b981', description: 'Detalhes da cobertura de autenticação multifator.' },
  identity_risk:     { label: 'Risco de Identidade',   icon: AlertTriangle, colorHex: '#ef4444', description: 'Usuários sinalizados como em risco ou comprometidos.' },
  failed_logins:     { label: 'Logins com Falha',      icon: LogIn,         colorHex: '#f59e0b', description: 'Análise de tentativas de login que falharam nos últimos 30 dias.' },
  administrators:    { label: 'Administradores',       icon: UserCog,       colorHex: '#8b5cf6', description: 'Usuários com funções administrativas privilegiadas.' },
  disabled_accounts: { label: 'Contas Desabilitadas',  icon: UserX,         colorHex: '#6366f1', description: 'Contas com login desabilitado no diretório.' },
  guest_users:       { label: 'Convidados',            icon: UserPlus,      colorHex: '#ec4899', description: 'Usuários externos convidados ao diretório.' },
  password_activity: { label: 'Atividade de Senhas',   icon: KeyRound,      colorHex: '#f97316', description: 'Resets, alterações e atividades de senha nos últimos 7 dias.' },
};

function MetricCard({ label, value, color, icon: Icon }: { label: string; value: string | number; color?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-secondary/30 p-3 rounded-lg">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={`font-bold text-lg ${color ?? ''}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

function ProportionalBar({ segments }: { segments: { label: string; value: number; colorClass: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-secondary/40">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.colorClass} transition-all`}
            style={{ width: `${(seg.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${seg.colorClass}`} />
            {seg.label}: {seg.value.toLocaleString()} ({total > 0 ? ((seg.value / total) * 100).toFixed(1) : 0}%)
          </div>
        ))}
      </div>
    </div>
  );
}

export function EntraIdCategorySheet({ open, onOpenChange, category, dashboardData }: EntraIdCategorySheetProps) {
  if (!category || !dashboardData) return null;

  const meta = CATEGORY_META[category];
  const IconComp = meta.icon;
  const { users, mfa, risks, loginActivity, admins, passwordActivity } = dashboardData;

  const renderContent = () => {
    switch (category) {
      case 'active_users': {
        const cloudOnly = Math.max(0, users.total - users.onPremSynced - users.guests);
        const internalUsers = users.total - users.guests;
        const enabledPct = internalUsers > 0 ? (users.signInEnabled / internalUsers) * 100 : 0;

        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Badge variant="outline" className="text-xs">Resumo do Diretório</Badge>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="Total" value={users.total} icon={Users} />
                <MetricCard label="Habilitados" value={users.signInEnabled} color="text-emerald-500" icon={User} />
                <MetricCard label="Desabilitados" value={users.disabled} color="text-indigo-500" icon={UserX} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Sign-in habilitado</span>
                  <span>{enabledPct.toFixed(1)}%</span>
                </div>
                <Progress value={enabledPct} className="h-2" />
              </div>
            </div>

            <div className="space-y-3">
              <Badge variant="outline" className="text-xs">Composição do Diretório</Badge>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="Cloud-Only" value={cloudOnly} icon={Cloud} color="text-sky-500" />
                <MetricCard label="Sincronizados" value={users.onPremSynced} icon={RefreshCw} color="text-violet-500" />
                <MetricCard label="Convidados" value={users.guests} icon={UserPlus} color="text-pink-500" />
              </div>
              <ProportionalBar segments={[
                { label: 'Cloud-Only', value: cloudOnly, colorClass: 'bg-sky-500' },
                { label: 'Sincronizados', value: users.onPremSynced, colorClass: 'bg-violet-500' },
                { label: 'Convidados', value: users.guests, colorClass: 'bg-pink-500' },
              ]} />
            </div>
          </div>
        );
      }

      case 'mfa_coverage': {
        const pct = mfa.total > 0 ? (mfa.enabled / mfa.total) * 100 : 0;
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Badge variant="outline" className="text-xs">Resumo MFA</Badge>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="Total Analisados" value={mfa.total} icon={Users} />
                <MetricCard label="Com MFA" value={mfa.enabled} color="text-emerald-500" icon={ShieldCheck} />
                <MetricCard label="Sem MFA" value={mfa.disabled} color="text-red-500" icon={AlertTriangle} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cobertura MFA</span>
                  <span>{pct.toFixed(1)}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            </div>

            <div className="space-y-3">
              <Badge variant="outline" className="text-xs">Distribuição MFA</Badge>
              <ProportionalBar segments={[
                { label: 'Com MFA', value: mfa.enabled, colorClass: 'bg-emerald-500' },
                { label: 'Sem MFA', value: mfa.disabled, colorClass: 'bg-red-500' },
              ]} />
            </div>
          </div>
        );
      }

      case 'identity_risk':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Total em Risco" value={risks.riskyUsers} />
              <MetricCard label="Em Risco Ativo" value={risks.atRisk} color="text-orange-500" />
              <MetricCard label="Comprometidos" value={risks.compromised} color="text-red-500" />
            </div>
          </div>
        );

      case 'failed_logins':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Total de Logins (30d)" value={loginActivity.total} />
              <MetricCard label="Sucesso" value={loginActivity.success} color="text-emerald-500" />
              <MetricCard label="Falhas" value={loginActivity.failed} color="text-amber-500" />
              <MetricCard label="MFA Exigido" value={loginActivity.mfaRequired} />
              <MetricCard label="Bloqueados" value={loginActivity.blocked} color="text-red-500" />
            </div>
          </div>
        );

      case 'administrators':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Total de Admins" value={admins.total} />
              <MetricCard label="Global Admins" value={admins.globalAdmins} color="text-amber-500" />
            </div>
          </div>
        );

      case 'disabled_accounts':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Contas Desabilitadas" value={users.disabled} />
              <MetricCard label="% do Total" value={`${users.total > 0 ? ((users.disabled / users.total) * 100).toFixed(1) : '0.0'}%`} />
            </div>
          </div>
        );

      case 'guest_users':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Total de Convidados" value={users.guests} />
              <MetricCard label="% do Diretório" value={`${users.total > 0 ? ((users.guests / users.total) * 100).toFixed(1) : '0.0'}%`} />
            </div>
          </div>
        );

      case 'password_activity':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Resets por Admin" value={passwordActivity.resets} />
              <MetricCard label="Alterações Forçadas" value={passwordActivity.forcedChanges} />
              <MetricCard label="Self-Service" value={passwordActivity.selfService} />
              <MetricCard label="Total (7d)" value={passwordActivity.resets + passwordActivity.forcedChanges + passwordActivity.selfService} />
            </div>
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
              <SheetDescription className="text-xs">{meta.description}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {renderContent()}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
