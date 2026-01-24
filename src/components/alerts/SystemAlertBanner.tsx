import { useState, useEffect } from 'react';
import { AlertTriangle, X, Settings, Info, AlertCircle, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SystemAlert {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  severity: string;
  metadata: Record<string, unknown>;
  created_at: string;
  dismissed_by?: string[];
}

export function SystemAlertBanner() {
  const { role, user } = useAuth();
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [dismissedLocally, setDismissedLocally] = useState<string[]>([]);

  useEffect(() => {
    if (role === 'super_admin' || role === 'workspace_admin') {
      fetchActiveAlerts();
    }
  }, [role]);

  const fetchActiveAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('system_alerts')
        .select('id, alert_type, title, message, severity, metadata, created_at, dismissed_by')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching alerts:', error);
        return;
      }

      // Filtrar alertas já dispensados pelo usuário atual
      const filteredData = (data || []).filter(alert => {
        const dismissedBy = alert.dismissed_by || [];
        return !dismissedBy.includes(user?.id || '');
      });

      // Ordenar por severidade (error > warning > success > info)
      const sortedData = filteredData.sort((a, b) => {
        const severityOrder: Record<string, number> = { error: 0, warning: 1, success: 2, info: 3 };
        return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
      });

      setAlerts(sortedData as SystemAlert[]);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const dismissAlert = async (alertId: string) => {
    if (!user?.id) return;

    try {
      // Buscar o alerta atual para adicionar o usuário ao array
      const { data: currentAlert } = await supabase
        .from('system_alerts')
        .select('dismissed_by')
        .eq('id', alertId)
        .single();

      if (currentAlert) {
        const dismissedBy = currentAlert.dismissed_by || [];
        if (!dismissedBy.includes(user.id)) {
          dismissedBy.push(user.id);
          
          await supabase
            .from('system_alerts')
            .update({ dismissed_by: dismissedBy })
            .eq('id', alertId);
        }
      }

      // Remover da lista local imediatamente
      setDismissedLocally(prev => [...prev, alertId]);
    } catch (error) {
      console.error('Error dismissing alert:', error);
      // Fallback: remover localmente
      setDismissedLocally(prev => [...prev, alertId]);
    }
  };

  // Filtrar alertas dispensados localmente
  const visibleAlerts = alerts.filter(alert => !dismissedLocally.includes(alert.id));

  if (!['super_admin', 'workspace_admin'].includes(role || '') || visibleAlerts.length === 0) {
    return null;
  }

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'error':
        return {
          container: 'bg-destructive/10 border-destructive/30 text-destructive',
          icon: AlertCircle,
        };
      case 'warning':
        return {
          container: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400',
          icon: AlertTriangle,
        };
      case 'success':
        return {
          container: 'bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400',
          icon: Shield,
        };
      default: // info
        return {
          container: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
          icon: Info,
        };
    }
  };

  // Mostrar apenas o alerta mais importante (primeiro da lista ordenada)
  const primaryAlert = visibleAlerts[0];
  const styles = getSeverityStyles(primaryAlert.severity);
  const IconComponent = styles.icon;

  return (
    <div className={`sticky top-0 z-50 w-full border-b px-4 py-3 ${styles.container}`}>
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <IconComponent className="h-5 w-5 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-sm truncate">{primaryAlert.title}</span>
            <span className="text-xs opacity-80 truncate">{primaryAlert.message}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {primaryAlert.alert_type.startsWith('m365_') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs"
              asChild
            >
              <Link to="/settings">
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Ver Configurações
              </Link>
            </Button>
          )}
          
          {primaryAlert.alert_type === 'firewall_analysis_completed' && (primaryAlert.metadata as Record<string, unknown>)?.firewall_id && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs"
              asChild
            >
              <Link to={`/scope-firewall/firewalls/${(primaryAlert.metadata as Record<string, unknown>).firewall_id}/analysis`}>
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                Ver Análise
              </Link>
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => dismissAlert(primaryAlert.id)}
            title="Dispensar alerta"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {visibleAlerts.length > 1 && (
        <div className="text-xs opacity-70 mt-1 text-center">
          +{visibleAlerts.length - 1} outro(s) alerta(s)
        </div>
      )}
    </div>
  );
}
