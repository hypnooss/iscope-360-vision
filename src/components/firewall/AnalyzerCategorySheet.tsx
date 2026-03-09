import * as LucideIcons from 'lucide-react';
import { ShieldX, ShieldCheck } from 'lucide-react';
import { getCountryCode } from '@/lib/countryUtils';
import 'flag-icons/css/flag-icons.min.css';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
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

function IPList({ items, colorClass }: { items?: TopBlockedIP[]; colorClass?: string }) {
  if (!items?.length) return <p className="text-xs text-muted-foreground py-2">Sem dados</p>;
  return (
    <>
      {items.slice(0, 10).map((item, idx) => (
        <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-mono truncate">{item.ip}</span>
            {item.country && (
              <span className={`fi fi-${getCountryCode(item.country) || 'xx'} text-base shrink-0`} title={item.country} />
            )}
          </div>
          <span className={cn('text-sm font-semibold shrink-0 ml-2', colorClass ?? 'text-foreground')}>
            {item.count.toLocaleString()}
          </span>
        </div>
      ))}
    </>
  );
}

function CountryList({ items, colorClass }: { items?: TopCountry[]; colorClass?: string }) {
  if (!items?.length) return <p className="text-xs text-muted-foreground py-2">Sem dados</p>;
  return (
    <>
      {items.slice(0, 10).map((item, idx) => (
        <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
          <span className="flex items-center gap-2">
            <span className={`fi fi-${getCountryCode(item.country) || 'xx'} text-base`} title={item.country} />
            <span className="text-sm">{item.country}</span>
          </span>
          <span className={cn('text-sm font-semibold', colorClass ?? 'text-foreground')}>
            {item.count.toLocaleString()}
          </span>
        </div>
      ))}
    </>
  );
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
  const isTrafficCategory = category === 'inbound_traffic' || category === 'outbound_traffic';

  // Get the correct data based on category
  const getTrafficData = () => {
    if (category === 'inbound_traffic') {
      return {
        blockedCount: metrics.inboundBlocked || 0,
        allowedCount: metrics.inboundAllowed || 0,
        blockedIPs: metrics.topInboundBlockedIPs,
        blockedCountries: metrics.topInboundBlockedCountries,
        allowedIPs: metrics.topInboundAllowedIPs,
        allowedCountries: metrics.topInboundAllowedCountries,
      };
    }
    return {
      blockedCount: metrics.outboundBlocked || 0,
      allowedCount: metrics.outboundConnections || 0,
      blockedIPs: metrics.topOutboundBlockedIPs,
      blockedCountries: metrics.topOutboundBlockedCountries,
      allowedIPs: metrics.topOutboundIPs,
      allowedCountries: metrics.topOutboundCountries,
    };
  };

  const renderTrafficContent = () => {
    const data = getTrafficData();
    
    return (
      <Tabs defaultValue="bloqueado" className="flex flex-col flex-1 min-h-0">
        <div className="border-b border-border shrink-0" />
        <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-6 h-auto py-0 shrink-0">
          <TabsTrigger
            value="bloqueado"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-xs gap-1.5"
          >
            <ShieldX className="w-3.5 h-3.5" />
            Bloqueado
          </TabsTrigger>
          <TabsTrigger
            value="permitido"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-xs gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Permitido
          </TabsTrigger>
        </TabsList>

        {/* Bloqueado tab */}
        <TabsContent value="bloqueado" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              {data.blockedCount > 0 && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                  {data.blockedCount.toLocaleString()} eventos bloqueados
                </Badge>
              )}

              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium">Top IPs Bloqueados</CardTitle>
                </CardHeader>
                <CardContent>
                  <IPList items={data.blockedIPs} colorClass="text-destructive" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium">Top Países Bloqueados</CardTitle>
                </CardHeader>
                <CardContent>
                  <CountryList items={data.blockedCountries} colorClass="text-destructive" />
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Permitido tab */}
        <TabsContent value="permitido" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              {data.allowedCount > 0 && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  {data.allowedCount.toLocaleString()} eventos permitidos
                </Badge>
              )}

              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium">Top IPs Permitidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <IPList items={data.allowedIPs} colorClass="text-emerald-600 dark:text-emerald-400" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium">Top Países Permitidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <CountryList items={data.allowedCountries} colorClass="text-emerald-600 dark:text-emerald-400" />
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    );
  };

  const renderCategoryContent = () => {
    switch (category) {
      case 'inbound_traffic':
      case 'outbound_traffic':
        return renderTrafficContent();

      case 'fw_authentication':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Top IPs (Falhas)</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topFwAuthIPsFailed?.slice(0, 10).map((item: TopBlockedIP, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <span className="text-sm font-mono">{item.ip}</span>
                    <span className="text-sm font-semibold text-red-500">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Top Países (Falhas)</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topFwAuthCountriesFailed?.slice(0, 10).map((item: TopCountry, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
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
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Top IPs (Falhas)</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topVpnAuthIPsFailed?.slice(0, 10).map((item: TopBlockedIP, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <span className="text-sm font-mono">{item.ip}</span>
                    <span className="text-sm font-semibold text-red-500">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Top Países (Falhas)</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topVpnAuthCountriesFailed?.slice(0, 10).map((item: TopCountry, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
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
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Top Categorias</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topWebFilterCategories?.slice(0, 10).map((item: TopCategory, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <span className="text-sm">{item.category}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Top Usuários</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topWebFilterUsers?.slice(0, 10).map((item: TopUserIP, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
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
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Top Aplicações</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topAppControlApps?.slice(0, 10).map((item: TopCategory, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <span className="text-sm">{item.category}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Top Usuários</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topAppControlUsers?.slice(0, 10).map((item: TopUserIP, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
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
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Top IPs de Origem</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topAnomalySources?.slice(0, 10).map((item: TopBlockedIP, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <span className="text-sm font-mono">{item.ip}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Top Tipos de Anomalia</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topAnomalyTypes?.slice(0, 10).map((item: TopCategory, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
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
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Domínios Detectados</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.botnetDomains?.slice(0, 10).map((item, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
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
      <SheetContent
        className={cn(
          'w-full sm:max-w-[50vw]',
          isTrafficCategory ? 'p-0 flex flex-col' : ''
        )}
      >
        <SheetHeader className={cn(isTrafficCategory ? 'px-6 pt-6 pb-0 shrink-0' : 'mb-2')}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${info.colorHex}15` }}>
              <DynamicIcon name={info.icon} className="w-5 h-5" style={{ color: info.colorHex }} />
            </div>
            <SheetTitle>{info.label}</SheetTitle>
          </div>
          <SheetDescription>{info.description}</SheetDescription>
        </SheetHeader>

        {isTrafficCategory ? (
          renderCategoryContent()
        ) : (
          <ScrollArea className="h-[calc(100vh-12rem)] mt-6">
            {renderCategoryContent()}
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
