import { useEffect, useState, useMemo, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { useFirewallSelector } from '@/hooks/useFirewallSelector';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FirewallOption { id: string; name: string; client_id: string; }

interface ConfigChangeRow {
  id: string;
  user_name: string;
  action: string;
  cfgpath: string;
  cfgobj: string;
  cfgattr: string;
  msg: string;
  category: string;
  severity: string;
  changed_at: string;
}

interface ParsedChange {
  field: string;
  oldVal?: string;
  newVal?: string;
  raw?: string;
}

/** Extract top-level field[content] tokens handling nested brackets via depth counting */
function tokenizeAttributes(raw: string): Array<{ field: string; content: string; start: number; end: number }> {
  const tokens: Array<{ field: string; content: string; start: number; end: number }> = [];
  let i = 0;
  while (i < raw.length) {
    // Try to match a field name followed by '['
    const fieldMatch = raw.substring(i).match(/^([a-zA-Z0-9_.:/-]+)\[/);
    if (fieldMatch) {
      const field = fieldMatch[1];
      const bracketStart = i + fieldMatch[0].length;
      let depth = 1;
      let j = bracketStart;
      while (j < raw.length && depth > 0) {
        if (raw[j] === '[') depth++;
        else if (raw[j] === ']') depth--;
        if (depth > 0) j++;
      }
      if (depth === 0) {
        const content = raw.substring(bracketStart, j);
        tokens.push({ field, content, start: i, end: j + 1 });
        i = j + 1;
      } else {
        // Unbalanced — skip this field name
        i += fieldMatch[0].length;
      }
    } else {
      i++;
    }
  }
  return tokens;
}

/** Parse FortiGate cfgattr format into human-readable changes */
function parseConfigAttribute(raw: string | null): ParsedChange[] {
  if (!raw || !raw.trim()) return [];

  const tokens = tokenizeAttributes(raw);

  // If no tokens found, return cleaned raw text
  if (tokens.length === 0) {
    const cleaned = raw.replace(/^\[|\]$/g, '').trim();
    if (!cleaned) return [];
    return [{ field: '', raw: cleaned }];
  }

  const results: ParsedChange[] = [];

  // Capture any text before the first token
  if (tokens[0].start > 0) {
    const prefix = raw.substring(0, tokens[0].start).replace(/[\[\]]/g, '').trim();
    if (prefix) results.push({ field: '', raw: prefix });
  }

  for (let t = 0; t < tokens.length; t++) {
    const { field, content } = tokens[t];

    // Handle password fields
    if (field.toLowerCase().includes('password') || content === '*') {
      results.push({ field, raw: '(protegido)' });
      continue;
    }

    // Check for arrow pattern (old->new)
    const arrowIdx = content.indexOf('->');
    if (arrowIdx !== -1 && !content.substring(0, arrowIdx).includes('[')) {
      results.push({
        field,
        oldVal: content.substring(0, arrowIdx).trim() || '(vazio)',
        newVal: content.substring(arrowIdx + 2).trim() || '(vazio)',
      });
    } else if (content.startsWith('<Delete>')) {
      // Deletion — try to extract sub-fields for readability
      const inner = content.replace('<Delete>', '').trim();
      const subTokens = tokenizeAttributes(inner);
      if (subTokens.length > 0) {
        const subParts = subTokens.map(s => `${s.field}: ${s.content}`).join(', ');
        results.push({ field, oldVal: subParts, newVal: '(removido)' });
      } else {
        results.push({ field, oldVal: inner || field, newVal: '(removido)' });
      }
    } else {
      // No arrow — could be a set value or nested content
      // Try to extract sub-fields
      const subTokens = tokenizeAttributes(content);
      if (subTokens.length > 0) {
        const subParts = subTokens.map(s => `${s.field}: ${s.content}`).join(', ');
        results.push({ field, raw: subParts });
      } else {
        results.push({ field, raw: content });
      }
    }

    // Capture gap text between tokens
    if (t < tokens.length - 1) {
      const gap = raw.substring(tokens[t].end, tokens[t + 1].start).replace(/[\[\]]/g, '').trim();
      if (gap) results.push({ field: '', raw: gap });
    }
  }

  // Capture trailing text
  const lastEnd = tokens[tokens.length - 1].end;
  if (lastEnd < raw.length) {
    const suffix = raw.substring(lastEnd).replace(/[\[\]]/g, '').trim();
    if (suffix) results.push({ field: '', raw: suffix });
  }

  // Filter out entries that are just punctuation/whitespace
  return results.filter(r => {
    const text = (r.field || '') + (r.oldVal || '') + (r.newVal || '') + (r.raw || '');
    return text.replace(/[\[\]\s]/g, '').length > 0;
  });
}

const severityColors: Record<string, string> = {
  critical: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  medium: 'text-warning border-warning/30 bg-warning/10',
  low: 'text-primary border-primary/30 bg-primary/10',
};

const PAGE_SIZE = 50;

export default function AnalyzerConfigChangesPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();
  const [searchUser, setSearchUser] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { data: allWorkspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuperRole && !isPreviewMode,
    staleTime: 1000 * 60 * 5,
  });

  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceSelector(allWorkspaces, isSuperRole);

  const { data: firewalls = [] } = useQuery({
    queryKey: ['analyzer-firewalls', selectedWorkspaceId, isSuperRole],
    queryFn: async () => {
      let query = supabase.from('firewalls').select('id, name, client_id').order('name');
      if (isSuperRole && selectedWorkspaceId) {
        query = query.eq('client_id', selectedWorkspaceId);
      }
      const { data } = await query;
      return (data ?? []) as FirewallOption[];
    },
    enabled: isSuperRole ? !!selectedWorkspaceId : true,
  });

  const { selectedFirewallId: selectedFirewall, setSelectedFirewallId: setSelectedFirewall } = useFirewallSelector(firewalls);

  useEffect(() => {
    if (!authLoading && !user) { navigate('/auth'); return; }
    if (!authLoading && user && !hasModuleAccess('scope_firewall')) navigate('/modules');
  }, [user, authLoading, navigate, hasModuleAccess]);

  useEffect(() => { setPage(0); }, [selectedFirewall, searchUser, filterCategory, dateRange]);

  const dateFilterStart = useMemo(() => {
    if (dateRange === 'all') return null;
    const d = new Date();
    if (dateRange === '7d') d.setDate(d.getDate() - 7);
    if (dateRange === '30d') d.setDate(d.getDate() - 30);
    if (dateRange === '90d') d.setDate(d.getDate() - 90);
    return d.toISOString();
  }, [dateRange]);

  const { data: queryResult, isLoading, refetch } = useQuery({
    queryKey: ['analyzer-config-changes', selectedFirewall, searchUser, filterCategory, dateRange, page],
    queryFn: async () => {
      if (!selectedFirewall) return { rows: [] as ConfigChangeRow[], total: 0 };

      let query = supabase
        .from('analyzer_config_changes' as any)
        .select('id, user_name, action, cfgpath, cfgobj, cfgattr, msg, category, severity, changed_at', { count: 'exact' })
        .eq('firewall_id', selectedFirewall)
        .order('changed_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (dateFilterStart) query = query.gte('changed_at', dateFilterStart);
      if (searchUser) query = query.ilike('user_name', `%${searchUser}%`);
      if (filterCategory !== 'all') query = query.eq('category', filterCategory);

      const { data, count, error } = await query as any;
      if (error) throw error;
      return { rows: (data ?? []) as ConfigChangeRow[], total: (count ?? 0) as number };
    },
    enabled: !!selectedFirewall,
    staleTime: 1000 * 30,
  });

  const rows = queryResult?.rows ?? [];
  const totalCount = queryResult?.total ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const { data: categories = ['all'] } = useQuery({
    queryKey: ['analyzer-config-categories', selectedFirewall],
    queryFn: async () => {
      if (!selectedFirewall) return ['all'];
      const { data } = await supabase
        .from('analyzer_config_changes' as any)
        .select('category')
        .eq('firewall_id', selectedFirewall) as any;
      const cats = new Set<string>((data ?? []).map((d: any) => d.category).filter(Boolean));
      return ['all', ...Array.from(cats).sort()];
    },
    enabled: !!selectedFirewall,
    staleTime: 1000 * 60 * 5,
  });

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <PageBreadcrumb items={[
          { label: 'Firewall' },
          { label: 'Analyzer', href: '/scope-firewall/analyzer' },
          { label: 'Alterações de Configuração' },
        ]} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/scope-firewall/analyzer')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Alterações de Configuração</h1>
              <p className="text-muted-foreground text-sm">Auditoria detalhada de modificações no firewall</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isSuperRole && !isPreviewMode && (
              <Select value={selectedWorkspaceId ?? ''} onValueChange={(v) => { setSelectedWorkspaceId(v); setSelectedFirewall(''); }}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  {allWorkspaces?.map(ws => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedFirewall} onValueChange={setSelectedFirewall}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Selecionar firewall" /></SelectTrigger>
              <SelectContent>
                {firewalls.map(fw => <SelectItem key={fw.id} value={fw.id}>{fw.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()} title="Atualizar dados">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por usuário..."
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c === 'all' ? 'Todas categorias' : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todo histórico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">
              {totalCount} alteração(ões) encontrada(s)
              {totalPages > 1 && <span className="text-muted-foreground font-normal ml-2">— Página {page + 1} de {totalPages}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm text-center py-8">Carregando...</p>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhuma alteração de configuração encontrada</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Objeto</TableHead>
                      <TableHead>Severidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((d) => {
                      const isExpanded = expandedRows.has(d.id);
                      const parsedChanges = isExpanded ? parseConfigAttribute(d.cfgattr) : [];
                      return (
                        <Fragment key={d.id}>
                          <TableRow
                            className="cursor-pointer"
                            onClick={() => toggleRow(d.id)}
                          >
                            <TableCell className="px-2">
                              {isExpanded
                                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell className="text-xs font-mono whitespace-nowrap">
                              {d.changed_at ? new Date(d.changed_at).toLocaleString('pt-BR') : '—'}
                            </TableCell>
                            <TableCell className="font-medium">{d.user_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{d.action || '—'}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{d.category || '—'}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate" title={d.cfgobj}>
                              {d.cfgobj || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={severityColors[d.severity] || ''}>
                                {d.severity}
                              </Badge>
                            </TableCell>
                          </TableRow>

                          {/* Expanded detail row */}
                          {isExpanded && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={7} className="py-4 px-6">
                                <div className="space-y-3">
                                   {/* Path + Action */}
                                   <div className="flex items-center gap-3 text-sm flex-wrap">
                                     <div className="flex items-center gap-2">
                                       <span className="text-muted-foreground font-medium">Path:</span>
                                       <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                                         {d.cfgpath || '—'}
                                       </code>
                                     </div>
                                     <div className="flex items-center gap-2">
                                       <span className="text-muted-foreground font-medium">Ação:</span>
                                       <Badge variant="outline" className="text-xs">{d.action || '—'}</Badge>
                                     </div>
                                   </div>

                                  {/* Parsed changes */}
                                  {parsedChanges.length > 0 && (
                                    <div>
                                      <span className="text-sm text-muted-foreground font-medium">Alterações:</span>
                                      <div className="mt-2 space-y-2">
                                        {parsedChanges.map((change, idx) => (
                                          <div key={idx} className="flex items-start gap-2 text-sm rounded-md bg-muted/50 px-3 py-2">
                                            {change.field && (
                                              <code className="text-xs font-mono font-semibold text-foreground shrink-0">
                                                {change.field}
                                              </code>
                                            )}
                                            {change.oldVal && change.newVal ? (
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-rose-400 line-through text-xs break-all">
                                                  {change.oldVal}
                                                </span>
                                                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                                <span className="text-emerald-400 text-xs font-medium break-all">
                                                  {change.newVal}
                                                </span>
                                              </div>
                                             ) : change.raw ? (
                                               <span className="text-xs text-muted-foreground break-all whitespace-pre-wrap">
                                                 {change.raw.length > 80
                                                   ? change.raw.split(/\s+/).map((token, ti) => (
                                                       <span key={ti} className="inline-block mr-1 mb-0.5 bg-muted px-1 py-0.5 rounded font-mono">{token}</span>
                                                     ))
                                                   : change.raw}
                                               </span>
                                            ) : null}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Original message */}
                                  {d.msg && (
                                    <div>
                                      <span className="text-sm text-muted-foreground font-medium">Mensagem:</span>
                                      <p className="text-xs font-mono text-muted-foreground mt-1 break-all">
                                        {d.msg}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Próxima <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
