import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Dashboard } from '@/components/Dashboard';
import { ComplianceReport, ComplianceCategory } from '@/types/compliance';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCategoryConfigs } from '@/hooks/useCategoryConfig';

const getIconForCategory = (name: string): string => {
  const icons: Record<string, string> = {
    'Administração': 'Settings',
    'Autenticação': 'Key',
    'Logging': 'FileText',
    'Rede': 'Network',
    'Segurança': 'Shield',
    'Sistema': 'Server',
    'Alta Disponibilidade': 'Server',
    'Atualizações e Firmware': 'RefreshCw',
    'Backup e Recovery': 'HardDrive',
    'Configuração VPN': 'Lock',
    'Configuração de Rede': 'Network',
    'Licenciamento': 'Key',
  };
  return icons[name] || 'CheckCircle';
};

const calculatePassRate = (checks: { status: string }[]): number => {
  if (!checks || checks.length === 0) return 0;
  const passed = checks.filter(c => c.status === 'pass').length;
  return Math.round((passed / checks.length) * 100);
};

const normalizeReportData = (rawData: Record<string, unknown>): ComplianceReport => {
  // Normalize checks: add description from details if missing, normalize status
  const normalizeCheck = (check: Record<string, unknown>) => ({
    ...check,
    description: check.description || check.details || check.name || '',
    status: check.status === 'warn' ? 'warning' : check.status,
  });
  
  // Transform categories from object to array if needed
  let categories = rawData.categories;
  if (categories && !Array.isArray(categories)) {
    // Convert object { "CategoryName": [...checks] } to array format
    categories = Object.entries(categories as Record<string, Record<string, unknown>[]>).map(([name, checks]) => {
      const normalizedChecks = (checks || []).map(normalizeCheck);
      return {
        name,
        icon: getIconForCategory(name),
        checks: normalizedChecks,
        passRate: calculatePassRate(normalizedChecks as { status: string }[]),
      };
    });
  } else if (Array.isArray(categories)) {
    // Normalize checks within existing array categories
    categories = (categories as { name: string; icon?: string; checks: Record<string, unknown>[]; passRate?: number }[]).map(cat => ({
      ...cat,
      icon: cat.icon || getIconForCategory(cat.name),
      checks: (cat.checks || []).map(normalizeCheck),
      passRate: cat.passRate ?? calculatePassRate((cat.checks || []).map(normalizeCheck) as { status: string }[]),
    }));
  } else {
    // No categories - initialize empty array
    categories = [];
  }
  
  // Get all checks for counting
  const allChecks = rawData.checks as { status: string }[] 
    ?? (categories as ComplianceCategory[])?.flatMap(c => c.checks) 
    ?? [];
  
  // Extract firmware version from multiple possible locations
  const firmwareVersion = (rawData.firmwareVersion as string) 
    ?? ((rawData.system_info as Record<string, unknown>)?.version as string)
    ?? undefined;
  
  // Extract system info - include vendor if present
  const rawSystemInfo = rawData.system_info as Record<string, unknown> | undefined;
  const systemInfo = rawSystemInfo ? {
    hostname: rawSystemInfo.hostname as string | undefined,
    model: rawSystemInfo.model as string | undefined,
    serial: rawSystemInfo.serial as string | undefined,
    uptime: rawSystemInfo.uptime as string | undefined,
    vendor: rawSystemInfo.vendor as string | undefined,
  } : undefined;
  
  return {
    overallScore: (rawData.overallScore as number) ?? (rawData.score as number) ?? 0,
    totalChecks: allChecks.length,
    passed: allChecks.filter(c => c.status === 'pass').length,
    failed: allChecks.filter(c => c.status === 'fail').length,
    warnings: allChecks.filter(c => c.status === 'warn' || c.status === 'warning').length,
    categories: categories as ComplianceCategory[],
    generatedAt: rawData.generatedAt 
      ? new Date(rawData.generatedAt as string) 
      : undefined,
    firmwareVersion,
    systemInfo,
  };
};

export default function FirewallAnalysis() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // Normalize the report from location state if it exists - memoize to avoid recalculation
  const initialReport = useMemo(() => {
    if (!location.state?.report) return null;
    return normalizeReportData(location.state.report as Record<string, unknown>);
  }, [location.state?.report]);
  
  const [report, setReport] = useState<ComplianceReport | null>(initialReport);
  const hasFetchedRef = useRef(false);
  const [firewall, setFirewall] = useState<{ name: string; fortigate_url: string; api_key: string; device_type_id: string | null } | null>(null);
  const [deviceVendor, setDeviceVendor] = useState<string | null>(null);
  const [deviceTypeId, setDeviceTypeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialReport);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNewAnalysis, setIsNewAnalysis] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!id || !user) return;
    if (hasFetchedRef.current) return;
    
    hasFetchedRef.current = true;
    fetchFirewall();
    
    if (!initialReport) {
      fetchLastAnalysis();
    } else {
      // Se veio do state, buscar apenas a data real do histórico
      fetchAnalysisDate();
    }
  }, [id, user]);

  const fetchAnalysisDate = async () => {
    const { data } = await supabase
      .from('analysis_history')
      .select('created_at')
      .eq('firewall_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.created_at) {
      setReport(prev => prev ? { ...prev, generatedAt: new Date(data.created_at) } : null);
    }
  };

  const fetchFirewall = async () => {
    const { data } = await supabase
      .from('firewalls')
      .select('name, fortigate_url, api_key, device_type_id')
      .eq('id', id)
      .single();

    if (data) {
      setFirewall(data);
      // Store device_type_id for category configs
      if (data.device_type_id) {
        setDeviceTypeId(data.device_type_id);
        // Fetch device type vendor
        const { data: deviceType } = await supabase
          .from('device_types')
          .select('vendor')
          .eq('id', data.device_type_id)
          .single();
        
        if (deviceType) {
          setDeviceVendor(deviceType.vendor);
        }
      }
    }
  };

  // Fetch category configs for the device type
  const { data: categoryConfigs } = useCategoryConfigs(deviceTypeId || undefined);

  const fetchLastAnalysis = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('analysis_history')
      .select('report_data, created_at')
      .eq('firewall_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.report_data) {
      const rawData = data.report_data as Record<string, unknown>;
      const reportData = normalizeReportData({
        ...rawData,
        generatedAt: data.created_at,
      });
      setReport(reportData);
    }
    setLoading(false);
  };


  const handleRefresh = async () => {
    if (!id) return;

    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-firewall-analysis', {
        body: { firewall_id: id },
      });

      if (error) throw error;
      
      if (!data.success) {
        // Handle specific error cases
        if (data.task_id) {
          // Task already exists
          toast.info(data.message || 'Já existe uma análise em andamento para este firewall.');
        } else {
          throw new Error(data.error || 'Erro ao criar tarefa de análise');
        }
        return;
      }

      toast.success('Análise agendada! O agent irá processar em breve.', {
        description: `Task ID: ${data.task_id?.slice(0, 8)}...`,
      });
    } catch (error: any) {
      toast.error('Erro ao agendar análise: ' + error.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnect = () => {
    navigate('/firewalls');
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!report) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8">
        <PageBreadcrumb
          items={[
            { label: 'Firewall', href: '/scope-firewall/firewalls' },
            { label: 'Relatórios', href: '/scope-firewall/reports' },
            { label: firewall?.name || 'Análise' },
          ]}
        />
          <Button variant="ghost" onClick={() => navigate('/scope-firewall/firewalls')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhuma análise encontrada para este firewall.</p>
            <p className="text-sm mt-2">Execute uma nova análise para ver os resultados.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <PageBreadcrumb
          items={[
            { label: 'Firewall', href: '/scope-firewall/firewalls' },
            { label: 'Relatórios', href: '/scope-firewall/reports' },
            { label: firewall?.name || 'Análise de Compliance' },
          ]}
        />
        <Dashboard
          report={report}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          firewallName={firewall?.name}
          firewallUrl={firewall?.fortigate_url}
          deviceVendor={deviceVendor}
          categoryConfigs={categoryConfigs}
          skipGaugeAnimation={!isNewAnalysis}
        />
      </div>
    </AppLayout>
  );
}
