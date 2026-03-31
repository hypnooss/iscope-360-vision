import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
}

interface ApiAccessLogsTableProps {
  keys: ApiKey[];
}

interface LogEntry {
  id: string;
  api_key_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  ip_address: string | null;
  response_time_ms: number | null;
  created_at: string;
}

export function ApiAccessLogsTable({ keys }: ApiAccessLogsTableProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterKeyId, setFilterKeyId] = useState('all');

  useEffect(() => {
    loadLogs();
  }, [filterKeyId]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'logs' });
      if (filterKeyId && filterKeyId !== 'all') params.set('key_id', filterKeyId);

      const { data, error } = await supabase.functions.invoke(
        `api-access-keys?${params.toString()}`,
        { method: 'GET' }
      );
      if (error) throw error;
      setLogs(data?.logs || []);
    } catch (err) {
      console.error('Error loading logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getKeyName = (keyId: string) => {
    const key = keys.find((k) => k.id === keyId);
    return key ? `${key.name} (${key.key_prefix}...)` : keyId?.substring(0, 8) + '...';
  };

  const getStatusBadge = (code: number) => {
    if (code >= 200 && code < 300) return <Badge variant="default" className="bg-green-600 text-xs">{code}</Badge>;
    if (code >= 400 && code < 500) return <Badge variant="destructive" className="text-xs">{code}</Badge>;
    return <Badge variant="secondary" className="text-xs">{code}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filterKeyId} onValueChange={setFilterKeyId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filtrar por chave" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as chaves</SelectItem>
              {keys.map((k) => (
                <SelectItem key={k.id} value={k.id}>{k.name} ({k.key_prefix}...)</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum log de acesso encontrado</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chave</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">{getKeyName(log.api_key_id)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{log.method}</Badge></TableCell>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate">{log.endpoint}</TableCell>
                  <TableCell>{getStatusBadge(log.status_code)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.ip_address || '-'}</TableCell>
                  <TableCell className="text-xs">{log.response_time_ms ? `${log.response_time_ms}ms` : '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), 'dd/MM HH:mm:ss')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
