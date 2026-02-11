import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Bug, Search, AlertTriangle, Shield, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TopCve {
  id: string;
  score: number;
}

interface CveCacheRow {
  id: string;
  module_code: string;
  client_id: string | null;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total_cves: number;
  top_cves: TopCve[] | null;
  updated_at: string;
  clients: { name: string } | null;
}

const MODULE_LABELS: Record<string, string> = {
  firewall: 'Firewall',
  m365: 'Microsoft 365',
};

const MODULE_COLORS: Record<string, string> = {
  firewall: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  m365: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

function getCveScoreColor(score: number) {
  if (score >= 9.0) return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  if (score >= 7.0) return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
  if (score >= 4.0) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
  return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
}

function getCveUrl(cveId: string) {
  return `https://nvd.nist.gov/vuln/detail/${cveId}`;
}

export default function CVEsCachePage() {
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('all');

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const { data: cveCache, isLoading, refetch } = useQuery({
    queryKey: ['admin-cve-cache'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cve_severity_cache')
        .select('*, clients(name)')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data as unknown as CveCacheRow[]) || [];
    },
  });

  // Compute stats
  const stats = useMemo(() => {
    if (!cveCache) return { total: 0, critical: 0, high: 0, lastUpdate: null as string | null };
    let total = 0, critical = 0, high = 0;
    let lastUpdate: string | null = null;

    for (const row of cveCache) {
      total += row.total_cves;
      critical += row.critical;
      high += row.high;
      if (!lastUpdate || row.updated_at > lastUpdate) {
        lastUpdate = row.updated_at;
      }
    }
    return { total, critical, high, lastUpdate };
  }, [cveCache]);

  // Filter and search
  const filtered = useMemo(() => {
    if (!cveCache) return [];
    return cveCache.filter(row => {
      if (filterModule !== 'all' && row.module_code !== filterModule) return false;
      if (search) {
        const clientName = row.clients?.name || 'Global';
        if (!clientName.toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [cveCache, search, filterModule]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb
          items={[
            { label: 'Administração' },
            { label: 'CVEs' },
          ]}
        />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CVEs</h1>
            <p className="text-muted-foreground">Cache centralizado de vulnerabilidades por módulo</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className={cn("w-4 h-4 mr-2", "animate-spin")} />
            Atualizando...
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bug className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total de CVEs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/10">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stats.critical}</p>
                  <p className="text-xs text-muted-foreground">Críticos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Shield className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stats.high}</p>
                  <p className="text-xs text-muted-foreground">Altos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {isLoading || !stats.lastUpdate ? '—' : formatDistanceToNow(new Date(stats.lastUpdate), { addSuffix: true, locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground">Última atualização</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar workspace..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterModule} onValueChange={setFilterModule}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              <SelectItem value="firewall">Firewall</SelectItem>
              <SelectItem value="m365">Microsoft 365</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                Nenhum registro de CVE encontrado no cache.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead className="text-center">Críticos</TableHead>
                    <TableHead className="text-center">Altos</TableHead>
                    <TableHead className="text-center">Médios</TableHead>
                    <TableHead className="text-center">Baixos</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead>Top CVEs</TableHead>
                    <TableHead>Última Atualização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(row => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Badge variant="outline" className={MODULE_COLORS[row.module_code] || ''}>
                          {MODULE_LABELS[row.module_code] || row.module_code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {row.clients?.name || 'Global'}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.critical > 0 ? (
                          <span className="text-rose-400 font-semibold">{row.critical}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.high > 0 ? (
                          <span className="text-orange-400 font-semibold">{row.high}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.medium > 0 ? (
                          <span className="text-yellow-400 font-semibold">{row.medium}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.low > 0 ? (
                          <span className="text-blue-400 font-semibold">{row.low}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-foreground">
                        {row.total_cves}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {(row.top_cves as TopCve[] | null)?.map((cve) => (
                            <a
                              key={cve.id}
                              href={getCveUrl(cve.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="no-underline"
                            >
                              <Badge
                                variant="outline"
                                className={cn(
                                  'cursor-pointer hover:opacity-80 transition-opacity gap-1',
                                  getCveScoreColor(cve.score)
                                )}
                              >
                                {cve.id}
                                <span className="font-bold">{cve.score}</span>
                              </Badge>
                            </a>
                          )) || <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
