import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  KeyRound,
  Search,
  Loader2,
  AlertTriangle,
  Database,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DehashedEntry {
  email: string;
  username: string;
  password: string;
  password_raw: string;
  hashed_password: string;
  hashed_password_raw: string;
  database_name: string;
  ip_address: string;
  name: string;
  phone: string;
}

interface DehashedCacheData {
  client_id: string;
  domain: string;
  total_entries: number;
  entries: DehashedEntry[];
  databases: string[];
  queried_at: string;
}

function StatCard({ icon: Icon, label, value, iconClass }: { icon: React.ElementType; label: string; value: number | string; iconClass?: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={cn("w-8 h-8", iconClass)} />
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineSection({
  icon: Icon,
  iconColor,
  iconBorderClass = "border-primary/40 bg-primary/10",
  title,
  isLast,
  children,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBorderClass?: string;
  title: string;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {!isLast && <div className="absolute left-6 top-full w-1 h-4 bg-primary/50 z-0" />}
      <div className="rounded-xl border border-border/60 bg-card/30 mb-4">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/40">
          <div className={cn("w-8 h-8 rounded-lg border-2 flex items-center justify-center shrink-0", iconBorderClass)}>
            <Icon className={cn("w-4 h-4", iconColor)} />
          </div>
          <h4 className="text-sm font-semibold">{title}</h4>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function LeakedCredentialsSection({
  clientId,
  domain,
  isSuperRole,
}: {
  clientId: string;
  domain: string | null;
  isSuperRole: boolean;
}) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Fetch cached data
  const { data: cacheData, isLoading } = useQuery({
    queryKey: ['dehashed-cache', clientId, domain],
    queryFn: async () => {
      if (!domain) return null;
      const { data, error } = await supabase
        .from('dehashed_cache' as any)
        .select('*')
        .eq('client_id', clientId)
        .eq('domain', domain)
        .order('queried_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = (data as any[])?.[0];
      if (!row) return null;
      return row as DehashedCacheData;
    },
    enabled: !!clientId && !!domain,
    staleTime: 1000 * 60 * 5,
  });

  // Check if API keys are configured
  const { data: apiKeysStatus } = useQuery({
    queryKey: ['dehashed-api-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        method: 'GET',
      });
      if (error) return { configured: false };
      const keys = data?.keys || [];
      const dehashedKey = keys.find((k: any) => k.name === 'DEHASHED_API_KEY');
      const dehashedEmail = keys.find((k: any) => k.name === 'DEHASHED_EMAIL');
      return {
        configured: dehashedKey?.configured && dehashedEmail?.configured,
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  // Query mutation
  const queryMutation = useMutation({
    mutationFn: async (forceRefresh: boolean) => {
      const { data, error } = await supabase.functions.invoke('dehashed-search', {
        body: { domain, client_id: clientId, force_refresh: forceRefresh },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.data as DehashedCacheData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dehashed-cache', clientId, domain] });
      toast.success('Consulta DeHashed concluída');
    },
    onError: (err: any) => {
      if (err.message?.includes('NO_API_KEY')) {
        toast.error('API keys do DeHashed não configuradas. Vá em Settings > API Keys.');
      } else {
        toast.error(`Erro ao consultar DeHashed: ${err.message}`);
      }
    },
  });

  // Stats
  const stats = useMemo(() => {
    if (!cacheData) return { total: 0, plaintext: 0, uniqueBreaches: 0, uniqueEmails: 0 };
    const entries = cacheData.entries || [];
    const plaintext = entries.filter((e) => e.password_raw && e.password_raw.length > 0).length;
    const emailSet = new Set(entries.map((e) => e.email).filter(Boolean));
    return {
      total: cacheData.total_entries,
      plaintext,
      uniqueBreaches: (cacheData.databases || []).length,
      uniqueEmails: emailSet.size,
    };
  }, [cacheData]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    if (!cacheData?.entries) return [];
    if (!searchTerm) return cacheData.entries;
    const q = searchTerm.toLowerCase();
    return cacheData.entries.filter(
      (e) =>
        e.email?.toLowerCase().includes(q) ||
        e.username?.toLowerCase().includes(q) ||
        e.database_name?.toLowerCase().includes(q)
    );
  }, [cacheData, searchTerm]);

  if (!domain) return null;

  // Cache age
  const cacheAgeText = cacheData?.queried_at
    ? (() => {
        const days = Math.floor((Date.now() - new Date(cacheData.queried_at).getTime()) / (1000 * 60 * 60 * 24));
        if (days === 0) return 'hoje';
        if (days === 1) return 'ontem';
        return `há ${days} dias`;
      })()
    : null;

  return (
    <TimelineSection
      icon={KeyRound}
      iconColor="text-rose-400"
      iconBorderClass="border-rose-400/40 bg-rose-400/10"
      title="Credenciais Vazadas (DeHashed)"
      isLast
    >
      {/* No API key configured */}
      {apiKeysStatus && !apiKeysStatus.configured && !cacheData && (
        <Card className="glass-card border-warning/30">
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Settings className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">API Keys do DeHashed não configuradas</p>
              <p className="text-sm mt-1">
                Vá em <strong>Settings &gt; API Keys</strong> e cadastre{' '}
                <code className="text-xs bg-muted px-1 rounded">DEHASHED_API_KEY</code> e{' '}
                <code className="text-xs bg-muted px-1 rounded">DEHASHED_EMAIL</code>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No data yet, but API keys might be configured */}
      {!cacheData && !isLoading && (apiKeysStatus?.configured || !apiKeysStatus) && (
        <Card className="glass-card">
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma consulta realizada</p>
              <p className="text-sm mt-1">Clique abaixo para consultar credenciais vazadas para <strong>{domain}</strong></p>
              {isSuperRole && (
                <Button
                  className="mt-4"
                  onClick={() => queryMutation.mutate(false)}
                  disabled={queryMutation.isPending}
                >
                  {queryMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  Consultar DeHashed
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Has data */}
      {cacheData && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={KeyRound} label="Total Vazamentos" value={stats.total} iconClass="text-rose-400" />
            <StatCard icon={Lock} label="Senhas em Texto Claro" value={stats.plaintext} iconClass="text-destructive" />
            <StatCard icon={Database} label="Breaches Únicos" value={stats.uniqueBreaches} iconClass="text-amber-400" />
            <StatCard icon={Mail} label="Emails Únicos" value={stats.uniqueEmails} iconClass="text-blue-400" />
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email, username ou breach..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {isSuperRole && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPasswords(!showPasswords)}
                className="gap-1.5"
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPasswords ? 'Ocultar' : 'Revelar'} Senhas
              </Button>
            )}

            {isSuperRole && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryMutation.mutate(true)}
                disabled={queryMutation.isPending}
                className="gap-1.5"
              >
                {queryMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Atualizar
              </Button>
            )}

            {cacheAgeText && (
              <span className="text-xs text-muted-foreground ml-auto">
                Última consulta: {cacheAgeText}
              </span>
            )}
          </div>

          {/* Breaches list */}
          {(cacheData.databases || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(cacheData.databases as string[]).map((db) => (
                <Badge key={db} variant="outline" className="text-[10px] px-1.5 bg-amber-500/10 text-amber-400 border-amber-500/30">
                  {db}
                </Badge>
              ))}
            </div>
          )}

          {/* Entries table */}
          {filteredEntries.length > 0 && (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Email / Username</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Senha</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Hash</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Breach</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.slice(0, 100).map((entry, i) => (
                      <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            {entry.email && <span className="font-mono text-xs">{entry.email}</span>}
                            {entry.username && entry.username !== entry.email && (
                              <span className="font-mono text-xs text-muted-foreground">{entry.username}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {entry.password_raw ? (
                            <span className="font-mono text-xs">
                              {showPasswords ? (
                                <span className="text-destructive">{entry.password_raw}</span>
                              ) : (
                                <span className="text-warning">{entry.password}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {entry.hashed_password ? (
                            <span className="font-mono text-xs text-muted-foreground">
                              {showPasswords ? entry.hashed_password_raw : entry.hashed_password}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {entry.database_name ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 bg-amber-500/10 text-amber-400 border-amber-500/30">
                              {entry.database_name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredEntries.length > 100 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border/30">
                  Exibindo 100 de {filteredEntries.length} resultados
                </div>
              )}
            </div>
          )}

          {filteredEntries.length === 0 && searchTerm && (
            <p className="text-center text-muted-foreground py-4 text-sm">
              Nenhum resultado para "{searchTerm}"
            </p>
          )}

          {stats.total === 0 && !searchTerm && (
            <Card className="glass-card">
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-teal-400 opacity-60" />
                  <p className="font-medium text-teal-400">Nenhuma credencial vazada encontrada</p>
                  <p className="text-sm mt-1">O domínio <strong>{domain}</strong> não possui registros no DeHashed.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </TimelineSection>
  );
}
