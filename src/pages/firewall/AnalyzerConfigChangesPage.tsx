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

// ─── Path-Specific Formatters ───────────────────────────────────────

/** firewall.policy, firewall.address, etc. — field[old->new] pattern */
function parseFieldBracketFormat(raw: string): ParsedChange[] {
  const results: ParsedChange[] = [];
  let i = 0;
  while (i < raw.length) {
    const fieldMatch = raw.substring(i).match(/^([a-zA-Z0-9_.:/-]+)\[/);
    if (!fieldMatch) { i++; continue; }
    const field = fieldMatch[1];
    const bracketStart = i + fieldMatch[0].length;
    let depth = 1, j = bracketStart;
    while (j < raw.length && depth > 0) {
      if (raw[j] === '[') depth++;
      else if (raw[j] === ']') depth--;
      if (depth > 0) j++;
    }
    if (depth !== 0) { i += fieldMatch[0].length; continue; }
    const content = raw.substring(bracketStart, j);
    i = j + 1;

    if (field.toLowerCase().includes('password') || content === '*') {
      results.push({ field, raw: '(protegido)' });
      continue;
    }
    const arrowIdx = content.indexOf('->');
    if (arrowIdx !== -1 && !content.substring(0, arrowIdx).includes('[')) {
      results.push({
        field,
        oldVal: content.substring(0, arrowIdx).trim() || '(vazio)',
        newVal: content.substring(arrowIdx + 2).trim() || '(vazio)',
      });
    } else if (content.startsWith('<Delete>')) {
      const inner = content.replace('<Delete>', '').trim();
      results.push({ field, oldVal: inner || field, newVal: '(removido)' });
    } else {
      results.push({ field, raw: content });
    }
  }
  return results;
}

/** firewall.vip — nested brackets with <Delete>, sub-fields */
function parseVipFormat(raw: string): ParsedChange[] {
  const results: ParsedChange[] = [];
  let i = 0;
  while (i < raw.length) {
    const fieldMatch = raw.substring(i).match(/^([a-zA-Z0-9_.:/-]+)\[/);
    if (!fieldMatch) { i++; continue; }
    const field = fieldMatch[1];
    const bracketStart = i + fieldMatch[0].length;
    let depth = 1, j = bracketStart;
    while (j < raw.length && depth > 0) {
      if (raw[j] === '[') depth++;
      else if (raw[j] === ']') depth--;
      if (depth > 0) j++;
    }
    if (depth !== 0) { i += fieldMatch[0].length; continue; }
    const content = raw.substring(bracketStart, j);
    i = j + 1;

    if (content.startsWith('<Delete>')) {
      const inner = content.replace('<Delete>', '').trim();
      // Try to extract sub key-value pairs from inner
      const subResults = parseFieldBracketFormat(inner);
      if (subResults.length > 0) {
        const subParts = subResults.map(s => `${s.field}: ${s.oldVal || s.newVal || s.raw || ''}`).join(', ');
        results.push({ field, oldVal: subParts, newVal: '(removido)' });
      } else {
        results.push({ field, oldVal: inner || field, newVal: '(removido)' });
      }
    } else {
      const arrowIdx = content.indexOf('->');
      if (arrowIdx !== -1 && !content.substring(0, arrowIdx).includes('[')) {
        results.push({
          field,
          oldVal: content.substring(0, arrowIdx).trim() || '(vazio)',
          newVal: content.substring(arrowIdx + 2).trim() || '(vazio)',
        });
      } else {
        // Nested content — extract sub-fields
        const subResults = parseFieldBracketFormat(content);
        if (subResults.length > 0) {
          const subParts = subResults.map(s => {
            if (s.oldVal && s.newVal) return `${s.field}: ${s.oldVal} → ${s.newVal}`;
            return `${s.field}: ${s.raw || ''}`;
          }).join(', ');
          results.push({ field, raw: subParts });
        } else {
          results.push({ field, raw: content });
        }
      }
    }
  }
  return results;
}

/** user.* paths — key-value pairs or nested bracket format */
function parseUserFormat(raw: string): ParsedChange[] {
  if (!raw.trim()) return [];
  const results: ParsedChange[] = [];

  // Detect nested bracket format: identifier:N[field[val]field[val]...]
  const nestedMatch = raw.match(/^(\w+):(\d+)\[(.+)\]$/s);
  if (nestedMatch) {
    results.push({ field: 'ID', raw: `${nestedMatch[1]}:${nestedMatch[2]}` });
    const inner = nestedMatch[3];
    // Depth-counting tokenizer for inner field[value] pairs
    let depth = 0;
    let tokenStart = 0;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '[') depth++;
      if (inner[i] === ']') {
        depth--;
        if (depth === 0) {
          const token = inner.substring(tokenStart, i + 1);
          const fm = token.match(/^([a-zA-Z0-9_-]+)\[(.+)\]$/s);
          if (fm) {
            const val = fm[2] === '*' ? '(protegido)' : fm[2];
            results.push({ field: fm[1], raw: val });
          } else if (token.trim()) {
            results.push({ field: '', raw: token.trim() });
          }
          tokenStart = i + 1;
        }
      }
    }
    return results;
  }

  // Check if it starts with an identifier like guest:N or member:N
  const identifierMatch = raw.match(/^(\w+:\d+)\s+/);
  if (identifierMatch) {
    results.push({ field: 'ID', raw: identifierMatch[1] });
    raw = raw.substring(identifierMatch[0].length);
  }

  // Handle password[*] before splitting
  raw = raw.replace(/password\[\*\]/g, 'password: (protegido)');
  // Remove trailing orphan brackets
  raw = raw.replace(/[\[\]]+$/g, '').trim();

  // Split by ", " to get key-value pairs
  const pairs = raw.split(/,\s+/).filter(Boolean);
  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx > 0 && colonIdx < pair.length - 1) {
      const key = pair.substring(0, colonIdx).trim();
      const val = pair.substring(colonIdx + 1).trim();
      results.push({ field: key, raw: val });
    } else if (pair.trim()) {
      // Try field[value] inside user context
      const bracketMatch = pair.match(/^([a-zA-Z0-9_-]+)\[(.+)\]$/);
      if (bracketMatch) {
        results.push({ field: bracketMatch[1], raw: bracketMatch[2] === '*' ? '(protegido)' : bracketMatch[2] });
      } else {
        results.push({ field: '', raw: pair.trim() });
      }
    }
  }
  return results;
}

/** Lists of IDs/MACs — tokenize by space, show as chips */
function parseListFormat(raw: string): ParsedChange[] {
  // Clean orphan brackets
  const cleaned = raw.replace(/[\[\]]/g, '').trim();
  if (!cleaned) return [];
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return [{ field: '', raw: cleaned }];
  // Return as a single entry with all tokens joined — the renderer will handle chip display
  return [{ field: '', raw: tokens.join(' ') }];
}

/** firewall.addrgrp — strips [NNN]: prefixes and tokenizes member list */
function parseAddrgrpFormat(raw: string | null): ParsedChange[] {
  if (!raw?.trim()) return [];
  // Strip numbered prefixes like [001]: or 001]:
  const cleaned = raw.replace(/\[?\d+\]\s*:\s*/g, '').trim();
  if (!cleaned) return [{ field: '', raw: raw }];
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return [{ field: 'Membros', raw: cleaned }];
  return [{ field: 'Membros', raw: tokens.join(' ') }];
}

/** Generic fallback — try key-value split, otherwise show cleaned text */
function parseFallback(raw: string): ParsedChange[] {
  if (!raw.trim()) return [];
  // Clean orphan brackets at edges
  let cleaned = raw.replace(/^\[+|\]+$/g, '').trim();
  if (!cleaned) return [];

  // If contains ": " patterns, try to split as key-value
  if (cleaned.includes(': ')) {
    const pairs = cleaned.split(/,\s+/).filter(Boolean);
    if (pairs.length > 1 && pairs.every(p => p.includes(':'))) {
      return pairs.map(pair => {
        const idx = pair.indexOf(':');
        return { field: pair.substring(0, idx).trim(), raw: pair.substring(idx + 1).trim() };
      });
    }
  }

  return [{ field: '', raw: cleaned }];
}

// ─── Dispatcher ─────────────────────────────────────────────────────

function formatByPath(cfgpath: string, cfgattr: string | null, action: string): ParsedChange[] {
  if (!cfgattr || !cfgattr.trim()) return [];

  const path = (cfgpath || '').toLowerCase();

  // user.adgrp → standard field[value] format
  if (path === 'user.adgrp') {
    const result = parseFieldBracketFormat(cfgattr);
    if (result.length > 0) return result;
  }

  // user.* paths → key-value or nested bracket format
  if (path.startsWith('user.')) {
    return parseUserFormat(cfgattr);
  }

  // firewall.vip → nested brackets
  if (path === 'firewall.vip' || path === 'firewall.vip6') {
    return parseVipFormat(cfgattr);
  }

  // firewall.addrgrp → member list with [NNN]: prefix pattern
  if (path === 'firewall.addrgrp' || path === 'firewall.addrgrp6') {
    return parseAddrgrpFormat(cfgattr);
  }

  // firewall.policy, firewall.address, system.*, vpn.* → standard field[old->new]
  if (
    path.startsWith('firewall.') ||
    path.startsWith('system.') ||
    path.startsWith('vpn.') ||
    path.startsWith('router.') ||
    path.startsWith('log.') ||
    path.startsWith('ips.') ||
    path.startsWith('antivirus.') ||
    path.startsWith('webfilter.') ||
    path.startsWith('dlp.') ||
    path.startsWith('wanopt.')
  ) {
    const result = parseFieldBracketFormat(cfgattr);
    if (result.length > 0) return result;
  }

  // If it looks like it has field[...] patterns, try bracket parser
  if (/[a-zA-Z0-9_]+\[/.test(cfgattr)) {
    const result = parseFieldBracketFormat(cfgattr);
    if (result.length > 0) return result;
  }

  // If it looks like a long list of tokens (MACs, IDs, etc.)
  const spaceTokens = cfgattr.trim().split(/\s+/);
  if (spaceTokens.length > 3 && !cfgattr.includes(':')) {
    return parseListFormat(cfgattr);
  }

  // Fallback
  return parseFallback(cfgattr);
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
                      const parsedChanges = isExpanded ? formatByPath(d.cfgpath, d.cfgattr, d.action) : [];
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
