import { useMemo } from 'react';
import type { AnalyzerSnapshot } from '@/types/analyzerInsights';
import type { FirewallSecurityInsight } from '@/types/firewallSecurityInsights';

export function useFirewallSecurityInsights(snapshot: AnalyzerSnapshot | null): FirewallSecurityInsight[] {
  return useMemo(() => {
    if (!snapshot) return [];
    
    const insights: FirewallSecurityInsight[] = [];
    const m = snapshot.metrics;

    // Heurística 1: VPN Bombardeada
    if ((m.vpnFailures || 0) > 100) {
      const countries = new Set(
        m.topVpnAuthCountriesFailed?.map(c => c.country) ?? []
      ).size;
      
      if (countries > 5) {
        insights.push({
          id: 'vpn-exposed',
          title: 'VPN Exposta a Ataques Globais',
          severity: 'high',
          icon: 'Wifi',
          what: `${m.vpnFailures} tentativas de VPN de ${countries} países diferentes.`,
          why: 'VPNs sem restrição geográfica são alvos constantes de ataques automatizados de força bruta.',
          bestPractice: [
            'Restringir origens por geolocalização (países permitidos)',
            'Implementar whitelist de IPs ou redes confiáveis',
            'Ativar autenticação multifator (MFA) obrigatória',
            'Configurar rate limiting para tentativas de login'
          ],
          businessImpact: 'Credenciais comprometidas podem resultar em acesso não autorizado à rede interna, exfiltração de dados sensíveis e violação de conformidade.',
          metrics: [
            { label: 'Tentativas Falhadas', value: m.vpnFailures || 0 },
            { label: 'Países Únicos', value: countries },
          ],
        });
      }
    }

    // Heurística 2: Admin Brute Force
    const totalAuth = (m.firewallAuthSuccesses || 0) + (m.firewallAuthFailures || 0);
    const adminFailRate = totalAuth > 0 ? (m.firewallAuthFailures || 0) / totalAuth : 0;
    
    if (adminFailRate > 0.5 && (m.firewallAuthFailures || 0) > 20) {
      insights.push({
        id: 'admin-brute-force',
        title: 'Alta Taxa de Falhas em Acesso Administrativo',
        severity: 'critical',
        icon: 'ShieldAlert',
        what: `${Math.round(adminFailRate * 100)}% das tentativas de login admin falharam (${m.firewallAuthFailures} falhas).`,
        why: 'Alta taxa de falhas indica tentativas de brute force ou credenciais vazadas.',
        bestPractice: [
          'Restringir acesso admin apenas a IPs internos ou VPN',
          'Nunca expor interface admin via WAN',
          'Implementar bloqueio temporário após N falhas',
          'Usar certificados ou chaves SSH ao invés de senhas'
        ],
        businessImpact: 'Comprometimento de conta admin resulta em controle total do firewall e possível desativação de proteções.',
        metrics: [
          { label: 'Taxa de Falha', value: `${Math.round(adminFailRate * 100)}%` },
          { label: 'Tentativas', value: totalAuth },
        ],
      });
    }

    // Heurística 3: Botnet Detection
    if ((m.botnetDetections || 0) > 0) {
      insights.push({
        id: 'botnet-c2',
        title: 'Comunicação com Botnets Detectada',
        severity: 'critical',
        icon: 'Bug',
        what: `${m.botnetDetections} tentativas de comunicação com servidores C&C de botnets conhecidos.`,
        why: 'Dispositivos internos podem estar comprometidos e sob controle remoto.',
        bestPractice: [
          'Ativar FortiGuard Botnet C&C Detection',
          'Implementar DNS Filtering para bloquear domínios maliciosos',
          'Segmentar rede (VLANs) para limitar propagação',
          'Realizar scan de malware em hosts internos'
        ],
        businessImpact: 'Dispositivos comprometidos podem ser usados para DDoS, mineração de criptomoedas ou exfiltração de dados.',
        metrics: [
          { label: 'Detecções', value: m.botnetDetections || 0 },
          { label: 'Domínios Únicos', value: m.botnetDomains?.length ?? 0 },
        ],
      });
    }

    // Heurística 4: Port Scan
    const portScanIPs = (m.topBlockedIPs ?? []).filter(ip => ip.targetPorts.length > 10);
    if (portScanIPs.length > 0) {
      insights.push({
        id: 'port-scan-detected',
        title: 'Port Scans Detectados',
        severity: 'high',
        icon: 'Radar',
        what: `${portScanIPs.length} IPs realizaram varredura em múltiplas portas (${portScanIPs[0].targetPorts.length} portas).`,
        why: 'Port scans são a fase de reconhecimento de ataques direcionados.',
        bestPractice: [
          'Configurar IDS/IPS para bloquear port scans',
          'Desabilitar serviços não utilizados em interfaces WAN',
          'Implementar rate limiting em firewalls de borda',
          'Monitorar logs de port scan para identificar padrões'
        ],
        businessImpact: 'Atacantes mapeiam serviços expostos para explorar vulnerabilidades conhecidas.',
        metrics: [
          { label: 'IPs Escaneando', value: portScanIPs.length },
          { label: 'Portas Testadas', value: portScanIPs[0].targetPorts.length },
        ],
      });
    }

    // Heurística 5: Anomalias de Tráfego
    if ((m.anomalyEvents || 0) > 20) {
      insights.push({
        id: 'traffic-anomalies',
        title: 'Alto Volume de Anomalias de Tráfego',
        severity: 'medium',
        icon: 'Zap',
        what: `${m.anomalyEvents} eventos anômalos detectados (DoS, DDoS, Port Scans).`,
        why: 'Anomalias indicam ataques de negação de serviço ou tentativas de exploração.',
        bestPractice: [
          'Ativar proteção DDoS em interfaces WAN',
          'Configurar rate limiting para prevenir flooding',
          'Implementar geoblocking para regiões de alto risco',
          'Monitorar padrões de tráfego em tempo real'
        ],
        businessImpact: 'Ataques DDoS podem causar indisponibilidade de serviços críticos e perda de receita.',
        metrics: [
          { label: 'Eventos Anômalos', value: m.anomalyEvents || 0 },
          { label: 'Tráfego Dropado', value: m.anomalyDropped || 0 },
        ],
      });
    }

    // Heurística 6: Alta Taxa de Bloqueio
    const blockRate = (m.totalEvents || 0) > 0 ? (m.totalDenied || 0) / (m.totalEvents || 1) : 0;
    if (blockRate > 0.7 && (m.totalDenied || 0) > 1000) {
      insights.push({
        id: 'high-block-rate',
        title: 'Taxa de Bloqueio Elevada',
        severity: 'medium',
        icon: 'Shield',
        what: `${Math.round(blockRate * 100)}% de todo o tráfego está sendo bloqueado (${m.totalDenied} eventos).`,
        why: 'Taxa muito alta pode indicar políticas restritivas demais ou ataques massivos.',
        bestPractice: [
          'Revisar políticas de firewall para verificar falsos positivos',
          'Analisar logs para identificar origens legítimas bloqueadas',
          'Ajustar regras para balancear segurança e usabilidade',
          'Considerar whitelist para serviços conhecidos'
        ],
        businessImpact: 'Bloqueios excessivos podem impactar operações legítimas e produtividade dos usuários.',
        metrics: [
          { label: 'Taxa de Bloqueio', value: `${Math.round(blockRate * 100)}%` },
          { label: 'Total Bloqueado', value: m.totalDenied || 0 },
        ],
      });
    }

    // Heurística 7: Sessões Persistentes
    if ((m.activeSessions || 0) > 1000) {
      insights.push({
        id: 'persistent-sessions',
        title: 'Alto Número de Sessões Persistentes',
        severity: 'low',
        icon: 'Users',
        what: `${m.activeSessions} sessões ativas simultâneas no firewall.`,
        why: 'Sessões longas podem indicar conexões zombie ou falta de timeout adequado.',
        bestPractice: [
          'Configurar timeout de sessão adequado para cada tipo de tráfego',
          'Implementar políticas de reconexão automática',
          'Monitorar sessões órfãs e limpá-las periodicamente',
          'Limitar número máximo de sessões por usuário/IP'
        ],
        businessImpact: 'Sessões órfãs consomem recursos do firewall e podem degradar performance.',
        metrics: [
          { label: 'Sessões Ativas', value: m.activeSessions || 0 },
        ],
      });
    }

    // Heurística 8: Tráfego Saída Bloqueado
    if ((m.outboundBlocked || 0) > 100) {
      insights.push({
        id: 'outbound-blocked',
        title: 'Alto Volume de Tráfego de Saída Bloqueado',
        severity: 'medium',
        icon: 'ArrowUpRight',
        what: `${m.outboundBlocked} conexões de saída foram bloqueadas.`,
        why: 'Tráfego de saída bloqueado pode indicar malware tentando se comunicar com servidores externos.',
        bestPractice: [
          'Implementar políticas de egress filtering rigorosas',
          'Categorizar destinos externos (Web Filter)',
          'Monitorar tentativas de conexão a IPs/domínios suspeitos',
          'Realizar varredura de malware em hosts internos'
        ],
        businessImpact: 'Malware não detectado pode exfiltrar dados sensíveis ou causar ransomware.',
        metrics: [
          { label: 'Conexões Bloqueadas', value: m.outboundBlocked || 0 },
          { label: 'IPs Únicos', value: m.topOutboundBlockedIPs?.length ?? 0 },
        ],
      });
    }

    return insights;
  }, [snapshot]);
}
