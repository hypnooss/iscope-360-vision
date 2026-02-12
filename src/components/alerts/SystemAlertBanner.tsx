import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X, Settings, Info, AlertCircle, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getAlertAgeMs, getAlertLifetimeMs } from './alertLifetime';
import { useAlertAutoHide } from './useAlertAutoHide';

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
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [dismissedLocally, setDismissedLocally] = useState<string[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchActiveAlerts();
    }
  }, [user?.id, role]);

  // Subscription para alertas em tempo real via Supabase Realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('system-alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_alerts'
        },
        (payload) => {
          console.log('New alert created:', payload);
          fetchActiveAlerts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_alerts'
        },
        (payload) => {
          console.log('Alert updated:', payload);
          fetchActiveAlerts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'system_alerts'
        },
        (payload) => {
          console.log('Alert deleted:', payload);
          fetchActiveAlerts();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, user?.id]);

  // Polling fallback - verificar a cada 10 segundos como backup do realtime
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      fetchActiveAlerts();
    }, 10000);

    return () => clearInterval(interval);
  }, [user?.id]);

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

      // Regra de negócio:
      // - Alertas M365*: apenas super_admin e super_suporte
      // - Alertas attack_surface_*: apenas super_admin e super_suporte
      // - Demais alertas: qualquer usuário autenticado
      const canSeeM365 = ['super_admin', 'super_suporte'].includes(role || '');
      const roleFiltered = filteredData.filter((alert) => {
        if (alert.alert_type?.startsWith('m365_')) return canSeeM365;
        if (alert.alert_type?.startsWith('attack_surface_')) return canSeeM365;
        return true;
      });

      // Filtrar alertas expirados pelo “lifetime” do banner (UI lifetime)
      const nowMs = Date.now();
      const notExpired = roleFiltered.filter((alert) => {
        const ageMs = getAlertAgeMs(alert.created_at, nowMs);
        const lifetimeMs = getAlertLifetimeMs(alert.alert_type);
        return ageMs < lifetimeMs;
      });

      // Ordenar por severidade (error > warning > success > info)
      const sortedData = notExpired.sort((a, b) => {
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

  const handleViewAnalysis = async (alertId: string, firewallId: string) => {
    await dismissAlert(alertId);
    navigate(`/scope-firewall/firewalls/${firewallId}/analysis`);
  };

  const handleViewExternalDomainReport = async (alertId: string, domainId: string, reportId: string) => {
    await dismissAlert(alertId);
    navigate(`/scope-external-domain/domains/${domainId}/report/${reportId}`);
  };

  const handleViewSettings = async (alertId: string) => {
    await dismissAlert(alertId);
    navigate('/settings');
  };

  // Filtrar alertas dispensados localmente
  const visibleAlerts = alerts.filter(alert => !dismissedLocally.includes(alert.id));

  // Mostrar apenas o alerta mais importante (primeiro da lista ordenada)
  // Importante: hooks abaixo NÃO podem ser condicionais (Rules of Hooks).
  const primaryAlert = visibleAlerts[0] ?? null;

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'error':
        return {
          border: 'border-destructive/50',
          text: 'text-destructive',
          iconBg: 'bg-gradient-to-br from-destructive/20 to-destructive/5 border-destructive/30',
          buttonClass: 'border-destructive/50 text-destructive hover:bg-destructive/10',
          Icon: AlertCircle,
        };
      case 'warning':
        return {
          border: 'border-yellow-500/50',
          text: 'text-yellow-400',
          iconBg: 'bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border-yellow-500/30',
          buttonClass: 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10',
          Icon: AlertTriangle,
        };
      case 'success':
        return {
          border: 'border-teal-500/50',
          text: 'text-teal-400',
          iconBg: 'bg-gradient-to-br from-teal-500/20 to-teal-500/5 border-teal-500/30',
          buttonClass: 'border-teal-500/50 text-teal-400 hover:bg-teal-500/10',
          Icon: Shield,
        };
      default: // info
        return {
          border: 'border-blue-500/50',
          text: 'text-blue-400',
          iconBg: 'bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/30',
          buttonClass: 'border-blue-500/50 text-blue-400 hover:bg-blue-500/10',
          Icon: Info,
        };
    }
  };

  const expireAlertLocally = useCallback(
    (alertId: string) => {
      setDismissedLocally((prev) => (prev.includes(alertId) ? prev : [...prev, alertId]));
      // Reavaliar e promover o próximo alerta, se existir
      fetchActiveAlerts();
    },
    // fetchActiveAlerts é estável o suficiente aqui (não depende de props); evita refatoração ampla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useAlertAutoHide(primaryAlert, expireAlertLocally);

  if (!user?.id || !primaryAlert) {
    return null;
  }

  const styles = getSeverityStyles(primaryAlert.severity);
  const IconComponent = styles.Icon;

  return (
    <div className="w-full animate-in slide-in-from-top duration-300">
      <div className={cn(
        "border-b shadow-lg",
        "bg-[hsl(222,47%,8%)]",
        styles.border
      )}>
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          {/* Ícone com círculo gradiente */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full border",
              styles.iconBg
            )}>
              <IconComponent className={cn("h-5 w-5", styles.text)} />
            </div>
            
            <div className="flex flex-col min-w-0">
              <span className={cn("font-semibold text-sm", styles.text)}>
                {primaryAlert.title}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {primaryAlert.message}
              </span>
            </div>
          </div>
          
          {/* Ações */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {primaryAlert.alert_type.startsWith('m365_') && (
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 px-4 text-xs font-medium", styles.buttonClass)}
                onClick={() => handleViewSettings(primaryAlert.id)}
              >
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Ver Configurações
              </Button>
            )}
            
            {primaryAlert.alert_type === 'firewall_analysis_completed' && 
             (primaryAlert.metadata as Record<string, unknown>)?.firewall_id && (
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 px-4 text-xs font-medium", styles.buttonClass)}
                onClick={() => handleViewAnalysis(
                  primaryAlert.id,
                  (primaryAlert.metadata as Record<string, unknown>).firewall_id as string
                )}
              >
                Ver Análise
              </Button>
            )}

            {primaryAlert.alert_type === 'external_domain_analysis_completed' &&
              (primaryAlert.metadata as Record<string, unknown>)?.domain_id &&
              (primaryAlert.metadata as Record<string, unknown>)?.report_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-8 px-4 text-xs font-medium", styles.buttonClass)}
                  onClick={() => handleViewExternalDomainReport(
                    primaryAlert.id,
                    (primaryAlert.metadata as Record<string, unknown>).domain_id as string,
                    (primaryAlert.metadata as Record<string, unknown>).report_id as string
                  )}
                >
                  Ver Relatório
                </Button>
              )}
            
            {/* Botão X para dispensar */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", styles.text)}
              onClick={() => dismissAlert(primaryAlert.id)}
              title="Dispensar alerta"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Contador de alertas adicionais */}
        {visibleAlerts.length > 1 && (
          <div className="border-t border-border/50 px-6 py-1.5 text-center">
            <span className="text-xs text-muted-foreground">
              +{visibleAlerts.length - 1} outro(s) alerta(s)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
