import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SignInLog {
  id: string;
  createdDateTime: string;
  userDisplayName: string;
  userPrincipalName: string;
  appDisplayName: string;
  ipAddress: string;
  location: {
    city: string;
    state: string;
    countryOrRegion: string;
  } | null;
  status: {
    errorCode: number;
    failureReason: string | null;
  };
  clientAppUsed: string;
  deviceDetail: {
    browser: string;
    operatingSystem: string;
  } | null;
  conditionalAccessStatus: string;
  isInteractive: boolean;
  riskState: string;
  riskLevelDuringSignIn: string;
}

export interface DirectoryAuditLog {
  id: string;
  activityDateTime: string;
  activityDisplayName: string;
  category: string;
  operationType: string;
  result: string;
  resultReason: string;
  initiatedBy: {
    user: {
      displayName: string;
      userPrincipalName: string;
    } | null;
    app: {
      displayName: string;
      appId: string;
    } | null;
  };
  targetResources: Array<{
    displayName: string;
    type: string;
    id: string;
  }>;
}

export type AuditLog = SignInLog | DirectoryAuditLog;
export type LogType = 'signIns' | 'directoryAudits';

export interface AuditLogFilters {
  dateFrom?: Date;
  dateTo?: Date;
  user?: string;
  status?: 'success' | 'failure';
}

interface UseEntraIdAuditLogsOptions {
  tenantRecordId: string | null;
  logType: LogType;
  filters?: AuditLogFilters;
}

interface UseEntraIdAuditLogsResult {
  logs: AuditLog[];
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  fetchLogs: () => Promise<void>;
}

export function useEntraIdAuditLogs({
  tenantRecordId,
  logType,
  filters,
}: UseEntraIdAuditLogsOptions): UseEntraIdAuditLogsResult {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextLink, setNextLink] = useState<string | null>(null);

  const fetchLogs = useCallback(async (skipToken?: string) => {
    if (!tenantRecordId) {
      setError('Tenant não selecionado');
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const requestBody: Record<string, any> = {
        tenant_record_id: tenantRecordId,
        log_type: logType,
        top: 50,
      };

      if (filters?.dateFrom) {
        requestBody.filter_date_from = filters.dateFrom.toISOString();
      }
      if (filters?.dateTo) {
        requestBody.filter_date_to = filters.dateTo.toISOString();
      }
      if (filters?.user) {
        requestBody.filter_user = filters.user;
      }
      if (filters?.status) {
        requestBody.filter_status = filters.status;
      }
      if (skipToken) {
        requestBody.skip_token = skipToken;
      }

      const { data, error: fnError } = await supabase.functions.invoke('entra-id-audit-logs', {
        body: requestBody,
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao buscar logs');
      }

      if (data?.error) {
        setErrorCode(data.errorCode || null);
        throw new Error(data.message || data.error);
      }

      if (skipToken) {
        setLogs(prev => [...prev, ...(data.logs || [])]);
      } else {
        setLogs(data.logs || []);
      }

      setHasMore(data.hasMore || false);
      setNextLink(data.nextLink || null);

    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [tenantRecordId, logType, filters]);

  const loadMore = useCallback(async () => {
    if (nextLink && !loading) {
      await fetchLogs(nextLink);
    }
  }, [nextLink, loading, fetchLogs]);

  const refresh = useCallback(async () => {
    setLogs([]);
    setNextLink(null);
    await fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    errorCode,
    hasMore,
    loadMore,
    refresh,
    fetchLogs,
  };
}
