import { X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ANALYZER_CATEGORY_INFO,
  type AnalyzerEventCategory,
  type AnalyzerSnapshot,
  type TopBlockedIP,
  type TopCountry,
  type TopCategory,
  type TopUserIP,
} from '@/types/analyzerInsights';

function DynamicIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const iconName = name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('') as keyof typeof LucideIcons;
  const IconComponent = LucideIcons[iconName] as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  if (!IconComponent) return <LucideIcons.Shield className={className} style={style} />;
  return <IconComponent className={className} style={style} />;
}

interface AnalyzerCategorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: AnalyzerEventCategory | null;
  snapshot: AnalyzerSnapshot;
}

export function AnalyzerCategorySheet({ open, onOpenChange, category, snapshot }: AnalyzerCategorySheetProps) {
  if (!category) return null;

  const info = ANALYZER_CATEGORY_INFO[category];
  const metrics = snapshot.metrics;

  const renderCategoryContent = () => {
    switch (category) {
      case 'denied_traffic':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top IPs Bloqueados</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topBlockedIPs?.slice(0, 10).map((item: TopBlockedIP, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">{item.ip}</span>
                      {item.country && (
                        <Badge variant="outline" className="text-xs">{item.country}</Badge>
                      )}
                    </div>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Países</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topCountries?.slice(0, 10).map((item: TopCountry, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{item.country}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );

      case 'fw_authentication':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top IPs (Falhas)</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topFwAuthIPsFailed?.slice(0, 10).map((item: TopBlockedIP, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-mono">{item.ip}</span>
                    <span className="text-sm font-semibold text-red-500">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Países (Falhas)</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topFwAuthCountriesFailed?.slice(0, 10).map((item: TopCountry, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{item.country}</span>
                    <span className="text-sm font-semibold text-red-500">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );

      case 'vpn_authentication':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top IPs (Falhas)</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topVpnAuthIPsFailed?.slice(0, 10).map((item: TopBlockedIP, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-mono">{item.ip}</span>
                    <span className="text-sm font-semibold text-red-500">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Países (Falhas)</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topVpnAuthCountriesFailed?.slice(0, 10).map((item: TopCountry, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{item.country}</span>
                    <span className="text-sm font-semibold text-red-500">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );

      case 'web_filter':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Categorias</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topWebFilterCategories?.slice(0, 10).map((item: TopCategory, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{item.category}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Usuários</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topWebFilterUsers?.slice(0, 10).map((item: TopUserIP, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{item.user}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );

      case 'app_control':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Aplicações</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topAppControlApps?.slice(0, 10).map((item: TopCategory, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{item.category}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Usuários</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topAppControlUsers?.slice(0, 10).map((item: TopUserIP, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{item.user}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );

      case 'anomalies':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top IPs de Origem</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topAnomalySources?.slice(0, 10).map((item: TopBlockedIP, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-mono">{item.ip}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Tipos de Anomalia</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topAnomalyTypes?.slice(0, 10).map((item: TopCategory, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{item.category}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );

      case 'botnet':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Domínios Detectados</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.botnetDomains?.slice(0, 10).map((item, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-mono break-all">{item.domain}</span>
                    <span className="text-sm font-semibold text-red-500">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return (
          <p className="text-sm text-muted-foreground">Nenhum detalhe disponível para esta categoria.</p>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${info.colorHex}15` }}>
              <DynamicIcon name={info.icon} className="w-5 h-5" style={{ color: info.colorHex }} />
            </div>
            <SheetTitle>{info.label}</SheetTitle>
          </div>
          <SheetDescription>{info.description}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-12rem)] mt-6">
          {renderCategoryContent()}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
