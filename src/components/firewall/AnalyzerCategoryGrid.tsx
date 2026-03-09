import { ExternalLink } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ANALYZER_CATEGORY_INFO,
  type AnalyzerEventCategory,
  type AnalyzerSnapshot,
} from '@/types/analyzerInsights';

function DynamicIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const iconName = name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('') as keyof typeof LucideIcons;
  const IconComponent = LucideIcons[iconName] as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  if (!IconComponent) return <LucideIcons.Shield className={className} style={style} />;
  return <IconComponent className={className} style={style} />;
}

interface AnalyzerCategoryGridProps {
  snapshot: AnalyzerSnapshot;
  onCategoryClick: (category: AnalyzerEventCategory) => void;
}

const CATEGORY_ORDER: AnalyzerEventCategory[] = [
  'inbound_traffic',
  'outbound_traffic',
  'fw_authentication',
  'vpn_authentication',
  'ips_events',
  'config_changes',
  'web_filter',
  'app_control',
  'anomalies',
  'botnet',
];

interface CategoryStats {
  total: number;
  success?: number;
  failed?: number;
  denied?: number;
  allowed?: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  topLabels?: string[];
}

function getCategoryStats(category: AnalyzerEventCategory, snapshot: AnalyzerSnapshot): CategoryStats {
  const metrics = snapshot.metrics;

  switch (category) {
    case 'inbound_traffic': {
      const denied = metrics.inboundBlocked || 0;
      const allowed = metrics.inboundAllowed || 0;
      const total = denied + allowed;
      return {
        total,
        denied,
        allowed,
        severity: denied > 1000 ? 'critical' : denied > 500 ? 'high' : denied > 100 ? 'medium' : denied > 0 ? 'low' : 'none',
      };
    }

    case 'outbound_traffic': {
      const denied = metrics.outboundBlocked || 0;
      const allowed = metrics.outboundConnections || 0;
      const total = denied + allowed;
      return {
        total,
        denied,
        allowed,
        severity: denied > 500 ? 'high' : denied > 100 ? 'medium' : denied > 0 ? 'low' : 'none',
      };
    }

    case 'fw_authentication': {
      const fwSuccess = metrics.firewallAuthSuccesses || 0;
      const fwFailed = metrics.firewallAuthFailures || 0;
      const fwTotal = fwSuccess + fwFailed;
      const fwFailRate = fwTotal > 0 ? fwFailed / fwTotal : 0;
      return {
        total: fwTotal,
        success: fwSuccess,
        failed: fwFailed,
        severity: fwFailRate > 0.8 ? 'critical' : fwFailRate > 0.5 ? 'high' : fwFailRate > 0.2 ? 'medium' : fwTotal > 0 ? 'low' : 'none',
      };
    }

    case 'vpn_authentication': {
      const vpnSuccess = metrics.vpnSuccesses || 0;
      const vpnFailed = metrics.vpnFailures || 0;
      const vpnTotal = vpnSuccess + vpnFailed;
      const vpnFailRate = vpnTotal > 0 ? vpnFailed / vpnTotal : 0;
      return {
        total: vpnTotal,
        success: vpnSuccess,
        failed: vpnFailed,
        severity: vpnFailRate > 0.8 ? 'critical' : vpnFailRate > 0.5 ? 'high' : vpnFailRate > 0.2 ? 'medium' : vpnTotal > 0 ? 'low' : 'none',
      };
    }

    case 'ips_events': {
      const ips = metrics.ipsEvents || 0;
      return {
        total: ips,
        severity: ips > 100 ? 'critical' : ips > 50 ? 'high' : ips > 10 ? 'medium' : ips > 0 ? 'low' : 'none',
      };
    }

    case 'config_changes': {
      const config = metrics.configChanges || 0;
      return {
        total: config,
        severity: config > 20 ? 'high' : config > 10 ? 'medium' : config > 0 ? 'low' : 'none',
      };
    }

    case 'web_filter': {
      const webFilter = metrics.webFilterBlocked || 0;
      const topLabels = (metrics.topWebFilterCategories || []).slice(0, 3).map(c => c.category);
      return {
        total: webFilter,
        severity: webFilter > 1000 ? 'high' : webFilter > 500 ? 'medium' : webFilter > 0 ? 'low' : 'none',
        topLabels,
      };
    }

    case 'app_control': {
      const appControl = metrics.appControlBlocked || 0;
      const topLabels = (metrics.topAppControlApps || []).slice(0, 3).map(c => c.category);
      return {
        total: appControl,
        severity: appControl > 1000 ? 'high' : appControl > 500 ? 'medium' : appControl > 0 ? 'low' : 'none',
        topLabels,
      };
    }

    case 'anomalies': {
      const anomaly = metrics.anomalyEvents || 0;
      const topLabels = (metrics.topAnomalyTypes || []).slice(0, 3).map(c => c.category);
      return {
        total: anomaly,
        severity: anomaly > 50 ? 'critical' : anomaly > 20 ? 'high' : anomaly > 5 ? 'medium' : anomaly > 0 ? 'low' : 'none',
        topLabels,
      };
    }

    case 'botnet': {
      const botnet = metrics.botnetDetections || 0;
      return {
        total: botnet,
        severity: botnet > 0 ? 'critical' : 'none',
      };
    }

    default:
      return { total: 0, severity: 'none' };
  }
}

const SEVERITY_COLORS = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-400',
  none: 'bg-muted/30',
};

export function AnalyzerCategoryGrid({ snapshot, onCategoryClick }: AnalyzerCategoryGridProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Panorama por Categoria</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORY_ORDER.map(catKey => {
          const info = ANALYZER_CATEGORY_INFO[catKey];
          const stats = getCategoryStats(catKey, snapshot);
          const hasData = stats.total > 0;
          const hasTrafficSplit = stats.denied !== undefined && stats.allowed !== undefined;

          return (
            <Card
              key={catKey}
              className={cn(
                'border cursor-pointer transition-all duration-200 hover:shadow-md group',
                !hasData ? 'opacity-50 border-border/30' : 'border-border/50 hover:border-border'
              )}
              onClick={() => onCategoryClick(catKey)}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${info.colorHex}15` }}>
                    <DynamicIcon name={info.icon} className="w-4.5 h-4.5" style={{ color: info.colorHex }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{info.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.total.toLocaleString()} {stats.total === 1 ? 'evento' : 'eventos'}
                    </p>
                  </div>
                </div>

                {/* Bicolor bar for auth/traffic split, regular severity bar otherwise */}
                {hasData && (stats.success !== undefined && stats.failed !== undefined) ? (
                  <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden flex">
                    <div
                      className="h-full bg-destructive transition-all"
                      style={{ width: `${(stats.failed! / stats.total) * 100}%` }}
                    />
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${(stats.success! / stats.total) * 100}%` }}
                    />
                  </div>
                ) : hasTrafficSplit && hasData ? (
                  <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden flex">
                    <div
                      className="h-full bg-destructive transition-all"
                      style={{ width: `${(stats.denied! / stats.total) * 100}%` }}
                    />
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${(stats.allowed! / stats.total) * 100}%` }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden">
                    {hasData && (
                      <div
                        className={cn('h-full rounded-full transition-all', SEVERITY_COLORS[stats.severity])}
                        style={{ width: '100%' }}
                      />
                    )}
                  </div>
                )}

                {/* Badges */}
                {hasData && hasTrafficSplit && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {stats.denied! > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-500 border-red-500/30">
                        {stats.denied!.toLocaleString()} Negado
                      </Badge>
                    )}
                    {stats.allowed! > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-500 border-green-500/30">
                        {stats.allowed!.toLocaleString()} Permitido
                      </Badge>
                    )}
                  </div>
                )}

                {hasData && !hasTrafficSplit && (stats.success !== undefined || stats.failed !== undefined) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {stats.failed !== undefined && stats.failed > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-500 border-red-500/30">
                        {stats.failed} Fail
                      </Badge>
                    )}
                    {stats.success !== undefined && stats.success > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-500 border-green-500/30">
                        {stats.success} OK
                      </Badge>
                    )}
                  </div>
                )}

                {hasData && !hasTrafficSplit && stats.success === undefined && stats.failed === undefined && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {stats.topLabels && stats.topLabels.length > 0 ? (
                      stats.topLabels.map((label) => (
                        <Badge
                          key={label}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                          style={{
                            backgroundColor: `${info.colorHex}15`,
                            color: info.colorHex,
                            borderColor: `${info.colorHex}30`,
                          }}
                        >
                          {label}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className={cn(
                        "text-[10px] px-1.5 py-0",
                        stats.severity === 'critical' && "bg-red-500/20 text-red-500 border-red-500/30",
                        stats.severity === 'high' && "bg-orange-500/20 text-orange-500 border-orange-500/30",
                        stats.severity === 'medium' && "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
                        stats.severity === 'low' && "bg-blue-400/20 text-blue-400 border-blue-400/30",
                      )}>
                        {stats.severity.charAt(0).toUpperCase() + stats.severity.slice(1)}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Click indicator */}
                <div className="flex justify-end mt-1">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
