import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FortiGateConfig {
  url: string;
  apiKey: string;
}

interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation?: string;
  details?: string;
}

// Função para fazer requisição à API do FortiGate
async function fortigateRequest(config: FortiGateConfig, endpoint: string) {
  const url = `${config.url}/api/v2${endpoint}`;
  console.log(`Fetching: ${url}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`FortiGate API error: ${response.status} - ${text}`);
    throw new Error(`FortiGate API error: ${response.status}`);
  }

  return await response.json();
}

// Verificar protocolos inseguros nas interfaces
async function checkInsecureProtocols(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  
  try {
    const interfaces = await fortigateRequest(config, '/cmdb/system/interface');
    
    const insecureHttpInterfaces: string[] = [];
    const insecureTelnetInterfaces: string[] = [];
    const sshWanInterfaces: string[] = [];
    
    for (const iface of interfaces.results || []) {
      const allowAccess = iface.allowaccess || '';
      
      if (allowAccess.includes('http') && !allowAccess.includes('https')) {
        insecureHttpInterfaces.push(iface.name);
      }
      if (allowAccess.includes('telnet')) {
        insecureTelnetInterfaces.push(iface.name);
      }
      if (iface.type === 'physical' && iface.role === 'wan' && allowAccess.includes('ssh')) {
        sshWanInterfaces.push(iface.name);
      }
    }
    
    checks.push({
      id: 'int-001',
      name: 'Protocolo HTTP na Interface de Gerência',
      description: 'Verifica se HTTP (não criptografado) está habilitado nas interfaces',
      category: 'Segurança de Interfaces',
      status: insecureHttpInterfaces.length > 0 ? 'fail' : 'pass',
      severity: 'critical',
      recommendation: insecureHttpInterfaces.length > 0 
        ? 'Desabilitar HTTP e utilizar apenas HTTPS para acesso administrativo'
        : 'Manter configuração atual',
      details: insecureHttpInterfaces.length > 0
        ? `HTTP habilitado nas interfaces: ${insecureHttpInterfaces.join(', ')}`
        : 'Nenhuma interface com HTTP inseguro',
    });
    
    checks.push({
      id: 'int-002',
      name: 'Protocolo Telnet Ativo',
      description: 'Verifica se Telnet está habilitado nas interfaces de gerenciamento',
      category: 'Segurança de Interfaces',
      status: insecureTelnetInterfaces.length > 0 ? 'fail' : 'pass',
      severity: 'critical',
      recommendation: insecureTelnetInterfaces.length > 0
        ? 'Desabilitar Telnet imediatamente e utilizar apenas SSH'
        : 'Manter configuração atual',
      details: insecureTelnetInterfaces.length > 0
        ? `Telnet habilitado nas interfaces: ${insecureTelnetInterfaces.join(', ')}`
        : 'Telnet desabilitado em todas as interfaces',
    });
    
    checks.push({
      id: 'int-003',
      name: 'SSH em Interface Externa',
      description: 'Verifica se SSH está exposto em interfaces WAN',
      category: 'Segurança de Interfaces',
      status: sshWanInterfaces.length > 0 ? 'warning' : 'pass',
      severity: 'high',
      recommendation: sshWanInterfaces.length > 0
        ? 'Restringir acesso SSH apenas a IPs de gerenciamento confiáveis'
        : 'Manter configuração atual',
      details: sshWanInterfaces.length > 0
        ? `SSH habilitado em interfaces WAN: ${sshWanInterfaces.join(', ')}`
        : 'SSH não exposto em interfaces WAN',
    });
  } catch (error) {
    console.error('Error checking interfaces:', error);
    checks.push({
      id: 'int-err',
      name: 'Erro ao verificar interfaces',
      description: 'Não foi possível verificar a configuração das interfaces',
      category: 'Segurança de Interfaces',
      status: 'pending',
      severity: 'high',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
  
  return checks;
}

// Verificar regras de firewall
async function checkFirewallRules(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  
  try {
    const policies = await fortigateRequest(config, '/cmdb/firewall/policy');
    
    const anySourceRules: string[] = [];
    const rdpExposed: string[] = [];
    const smbExposed: string[] = [];
    const anyAnyRules: string[] = [];
    
    for (const policy of policies.results || []) {
      const srcaddr = policy.srcaddr?.map((s: any) => s.name).join(',') || '';
      const dstaddr = policy.dstaddr?.map((d: any) => d.name).join(',') || '';
      const service = policy.service?.map((s: any) => s.name).join(',') || '';
      
      // Regras de entrada sem restrição
      if (srcaddr.includes('all') && policy.srcintf?.[0]?.name?.toLowerCase().includes('wan')) {
        anySourceRules.push(`Regra #${policy.policyid}`);
      }
      
      // RDP exposto
      if (service.toLowerCase().includes('rdp') || service.includes('3389')) {
        if (srcaddr.includes('all')) {
          rdpExposed.push(`Regra #${policy.policyid}`);
        }
      }
      
      // SMB exposto
      if (service.toLowerCase().includes('smb') || service.includes('445') || service.includes('139')) {
        if (srcaddr.includes('all')) {
          smbExposed.push(`Regra #${policy.policyid}`);
        }
      }
      
      // Regras any-any
      if (srcaddr.includes('all') && dstaddr.includes('all')) {
        anyAnyRules.push(`Regra #${policy.policyid}`);
      }
    }
    
    checks.push({
      id: 'inb-001',
      name: 'Regras de Entrada sem Restrição de Origem',
      description: 'Identifica regras de entrada (WAN→LAN) que aceitam qualquer IP de origem',
      category: 'Regras de Entrada',
      status: anySourceRules.length > 0 ? 'fail' : 'pass',
      severity: 'critical',
      recommendation: anySourceRules.length > 0
        ? 'Restringir origem das regras para IPs ou ranges específicos'
        : 'Manter configuração atual',
      details: anySourceRules.length > 0
        ? `${anySourceRules.length} regras com source "all": ${anySourceRules.join(', ')}`
        : 'Todas as regras possuem origem restrita',
    });
    
    checks.push({
      id: 'inb-002',
      name: 'RDP Exposto para Internet',
      description: 'Verifica se há regras expondo RDP (3389) para a internet',
      category: 'Regras de Entrada',
      status: rdpExposed.length > 0 ? 'fail' : 'pass',
      severity: 'critical',
      recommendation: rdpExposed.length > 0
        ? 'Remover acesso RDP direto da internet. Utilizar VPN ou bastion host'
        : 'Manter configuração atual',
      details: rdpExposed.length > 0
        ? `RDP exposto: ${rdpExposed.join(', ')}`
        : 'RDP não exposto para internet',
    });
    
    checks.push({
      id: 'inb-003',
      name: 'SMB/CIFS Exposto para Internet',
      description: 'Verifica se há regras expondo portas SMB (445, 139) para a internet',
      category: 'Regras de Entrada',
      status: smbExposed.length > 0 ? 'fail' : 'pass',
      severity: 'critical',
      recommendation: smbExposed.length > 0
        ? 'Bloquear imediatamente portas SMB da internet'
        : 'Manter configuração atual',
      details: smbExposed.length > 0
        ? `SMB exposto: ${smbExposed.join(', ')}`
        : 'SMB não exposto para internet',
    });
    
    checks.push({
      id: 'net-003',
      name: 'Regras "Any-Any"',
      description: 'Verifica existência de regras permissivas demais',
      category: 'Configuração de Rede',
      status: anyAnyRules.length > 0 ? 'fail' : 'pass',
      severity: 'critical',
      recommendation: anyAnyRules.length > 0
        ? 'Remover ou restringir regras any-any identificadas'
        : 'Manter configuração atual',
      details: anyAnyRules.length > 0
        ? `${anyAnyRules.length} regras any-any: ${anyAnyRules.join(', ')}`
        : 'Nenhuma regra any-any encontrada',
    });
  } catch (error) {
    console.error('Error checking firewall rules:', error);
    checks.push({
      id: 'fw-err',
      name: 'Erro ao verificar regras de firewall',
      description: 'Não foi possível verificar as políticas de firewall',
      category: 'Configuração de Rede',
      status: 'pending',
      severity: 'high',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
  
  return checks;
}

// Verificar configurações de segurança do admin
async function checkAdminSecurity(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  
  try {
    const adminSettings = await fortigateRequest(config, '/cmdb/system/global');
    const admins = await fortigateRequest(config, '/cmdb/system/admin');
    
    const settings = adminSettings.results || {};
    const adminList = admins.results || [];
    
    // 2FA
    const adminsWithout2FA = adminList.filter((a: any) => a['two-factor'] === 'disable');
    checks.push({
      id: 'sec-002',
      name: 'Autenticação de Dois Fatores',
      description: 'Verifica se 2FA está habilitado para acesso administrativo',
      category: 'Políticas de Segurança',
      status: adminsWithout2FA.length > 0 ? 'fail' : 'pass',
      severity: 'critical',
      recommendation: adminsWithout2FA.length > 0
        ? 'Habilitar autenticação de dois fatores para todos os administradores'
        : 'Manter configuração atual',
      details: adminsWithout2FA.length > 0
        ? `${adminList.length - adminsWithout2FA.length} de ${adminList.length} administradores possuem 2FA`
        : 'Todos os administradores possuem 2FA habilitado',
    });
    
    // Timeout de sessão
    const adminTimeout = settings['admin-lockout-threshold'] || 0;
    checks.push({
      id: 'sec-003',
      name: 'Timeout de Sessão',
      description: 'Verifica configuração de timeout de sessão administrativa',
      category: 'Políticas de Segurança',
      status: adminTimeout > 30 ? 'warning' : 'pass',
      severity: 'medium',
      recommendation: adminTimeout > 30
        ? 'Reduzir timeout de sessão para 15-30 minutos'
        : 'Manter configuração atual',
      details: `Timeout atual: ${adminTimeout} minutos`,
    });
    
    // Política de senha
    const strongCrypto = settings['strong-crypto'] === 'enable';
    checks.push({
      id: 'sec-001',
      name: 'Criptografia Forte',
      description: 'Verifica se criptografia forte está habilitada',
      category: 'Políticas de Segurança',
      status: strongCrypto ? 'pass' : 'warning',
      severity: 'high',
      recommendation: !strongCrypto
        ? 'Habilitar strong-crypto para forçar uso de algoritmos seguros'
        : 'Manter configuração atual',
    });
  } catch (error) {
    console.error('Error checking admin security:', error);
    checks.push({
      id: 'adm-err',
      name: 'Erro ao verificar segurança administrativa',
      description: 'Não foi possível verificar configurações de admin',
      category: 'Políticas de Segurança',
      status: 'pending',
      severity: 'high',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
  
  return checks;
}

// Verificar configurações UTM (IPS, Web Filter, App Control)
async function checkUTMProfiles(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  
  try {
    // IPS
    const ipsProfiles = await fortigateRequest(config, '/cmdb/ips/sensor');
    const policies = await fortigateRequest(config, '/cmdb/firewall/policy');
    
    const policiesWithIPS = (policies.results || []).filter((p: any) => p['ips-sensor']);
    const totalPolicies = (policies.results || []).length;
    
    checks.push({
      id: 'utm-001',
      name: 'Perfil IPS/IDS Ativo',
      description: 'Verifica se perfis de Intrusion Prevention estão aplicados nas políticas',
      category: 'Perfis de Segurança UTM',
      status: policiesWithIPS.length < totalPolicies * 0.7 ? 'warning' : 'pass',
      severity: 'critical',
      recommendation: policiesWithIPS.length < totalPolicies
        ? 'Aplicar perfil IPS em todas as regras de tráfego de entrada'
        : 'Manter configuração atual',
      details: `IPS aplicado em ${policiesWithIPS.length} de ${totalPolicies} políticas`,
    });
    
    // Web Filter
    const policiesWithWebFilter = (policies.results || []).filter((p: any) => p['webfilter-profile']);
    checks.push({
      id: 'utm-004',
      name: 'Web Filter Ativo',
      description: 'Verifica se filtro de conteúdo web está aplicado nas políticas de saída',
      category: 'Perfis de Segurança UTM',
      status: policiesWithWebFilter.length < totalPolicies * 0.5 ? 'warning' : 'pass',
      severity: 'high',
      recommendation: policiesWithWebFilter.length < totalPolicies
        ? 'Aplicar Web Filter em todas as políticas de acesso à internet'
        : 'Manter configuração atual',
      details: `Web Filter aplicado em ${policiesWithWebFilter.length} de ${totalPolicies} políticas`,
    });
    
    // Application Control
    const policiesWithAppCtrl = (policies.results || []).filter((p: any) => p['application-list']);
    checks.push({
      id: 'utm-007',
      name: 'Application Control Ativo',
      description: 'Verifica se controle de aplicações está aplicado nas políticas',
      category: 'Perfis de Segurança UTM',
      status: policiesWithAppCtrl.length < totalPolicies * 0.5 ? 'warning' : 'pass',
      severity: 'medium',
      recommendation: policiesWithAppCtrl.length < totalPolicies
        ? 'Aplicar Application Control para visibilidade e controle de aplicações'
        : 'Manter configuração atual',
      details: `Application Control aplicado em ${policiesWithAppCtrl.length} de ${totalPolicies} políticas`,
    });
    
    // Antivírus
    const policiesWithAV = (policies.results || []).filter((p: any) => p['av-profile']);
    checks.push({
      id: 'utm-009',
      name: 'Antivírus de Gateway',
      description: 'Verifica se antivírus está habilitado para escanear arquivos',
      category: 'Perfis de Segurança UTM',
      status: policiesWithAV.length < totalPolicies * 0.5 ? 'warning' : 'pass',
      severity: 'critical',
      recommendation: policiesWithAV.length < totalPolicies
        ? 'Aplicar perfil de antivírus em todas as políticas'
        : 'Manter configuração atual',
      details: `Antivírus aplicado em ${policiesWithAV.length} de ${totalPolicies} políticas`,
    });
  } catch (error) {
    console.error('Error checking UTM profiles:', error);
    checks.push({
      id: 'utm-err',
      name: 'Erro ao verificar perfis UTM',
      description: 'Não foi possível verificar configurações UTM',
      category: 'Perfis de Segurança UTM',
      status: 'pending',
      severity: 'high',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
  
  return checks;
}

// Verificar HA e Backup
async function checkHAAndBackup(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  
  try {
    // HA Status
    const haStatus = await fortigateRequest(config, '/cmdb/system/ha');
    const haSettings = haStatus.results || {};
    
    const haMode = haSettings.mode || 'standalone';
    checks.push({
      id: 'ha-001',
      name: 'Cluster HA Configurado',
      description: 'Verifica se alta disponibilidade está configurada',
      category: 'Alta Disponibilidade',
      status: haMode === 'standalone' ? 'warning' : 'pass',
      severity: 'critical',
      recommendation: haMode === 'standalone'
        ? 'Considerar configurar HA para alta disponibilidade'
        : 'Manter configuração atual',
      details: `Modo HA: ${haMode}`,
    });
    
    if (haMode !== 'standalone') {
      const hbInterfaces = haSettings['hbdev'] || '';
      checks.push({
        id: 'ha-003',
        name: 'Heartbeat HA',
        description: 'Verifica configuração dos links de heartbeat',
        category: 'Alta Disponibilidade',
        status: hbInterfaces.split(' ').length < 2 ? 'warning' : 'pass',
        severity: 'high',
        recommendation: 'Configurar múltiplos links de heartbeat para redundância',
        details: `Interfaces de heartbeat: ${hbInterfaces || 'Nenhuma configurada'}`,
      });
    }
    
    // Backup - verificar configuração de auto-backup
    try {
      const autoBackup = await fortigateRequest(config, '/cmdb/system/auto-script');
      const backupScripts = (autoBackup.results || []).filter((s: any) => 
        s.script?.toLowerCase().includes('backup') || s.name?.toLowerCase().includes('backup')
      );
      
      checks.push({
        id: 'bkp-001',
        name: 'Backup Automático Configurado',
        description: 'Verifica se backup automático de configuração está habilitado',
        category: 'Backup e Recovery',
        status: backupScripts.length === 0 ? 'fail' : 'pass',
        severity: 'critical',
        recommendation: backupScripts.length === 0
          ? 'Configurar backup automático para servidor TFTP/SCP ou FortiManager'
          : 'Manter configuração atual',
        details: backupScripts.length > 0
          ? `${backupScripts.length} script(s) de backup configurado(s)`
          : 'Nenhum backup automático configurado',
      });
    } catch {
      checks.push({
        id: 'bkp-001',
        name: 'Backup Automático Configurado',
        description: 'Verifica se backup automático de configuração está habilitado',
        category: 'Backup e Recovery',
        status: 'warning',
        severity: 'critical',
        recommendation: 'Verificar configuração de backup manualmente',
        details: 'Não foi possível verificar configuração de auto-backup',
      });
    }
  } catch (error) {
    console.error('Error checking HA and backup:', error);
    checks.push({
      id: 'ha-err',
      name: 'Erro ao verificar HA/Backup',
      description: 'Não foi possível verificar configurações de HA e backup',
      category: 'Alta Disponibilidade',
      status: 'pending',
      severity: 'high',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
  
  return checks;
}

// Verificar firmware e atualizações
async function checkFirmware(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  
  try {
    const systemStatus = await fortigateRequest(config, '/monitor/system/status');
    const status = systemStatus.results || {};
    
    const currentVersion = status.version || 'Desconhecida';
    
    checks.push({
      id: 'upd-001',
      name: 'Versão do Firmware',
      description: 'Verifica a versão atual do firmware',
      category: 'Atualizações',
      status: 'pass',
      severity: 'high',
      details: `Versão atual: FortiOS ${currentVersion}`,
      recommendation: 'Verificar se há atualizações disponíveis no suporte Fortinet',
    });
  } catch (error) {
    console.error('Error checking firmware:', error);
    checks.push({
      id: 'upd-err',
      name: 'Erro ao verificar firmware',
      description: 'Não foi possível verificar a versão do firmware',
      category: 'Atualizações',
      status: 'pending',
      severity: 'high',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
  
  return checks;
}

// Verificar VPN
async function checkVPN(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  
  try {
    const vpnIpsec = await fortigateRequest(config, '/cmdb/vpn.ipsec/phase1-interface');
    const vpnPhase1 = vpnIpsec.results || [];
    
    const weakCrypto = vpnPhase1.filter((v: any) => {
      const proposal = v.proposal || '';
      return proposal.includes('des') || proposal.includes('md5');
    });
    
    checks.push({
      id: 'vpn-001',
      name: 'Criptografia VPN',
      description: 'Verifica se algoritmos de criptografia fortes estão em uso',
      category: 'Configuração VPN',
      status: weakCrypto.length > 0 ? 'fail' : 'pass',
      severity: 'critical',
      recommendation: weakCrypto.length > 0
        ? 'Atualizar para algoritmos de criptografia mais fortes (AES-256, SHA-256)'
        : 'Manter configuração atual',
      details: weakCrypto.length > 0
        ? `${weakCrypto.length} VPN(s) com criptografia fraca detectada(s)`
        : 'Todas as VPNs utilizam criptografia forte',
    });
    
    // Verificar certificados
    const certificates = await fortigateRequest(config, '/cmdb/certificate/local');
    const certs = certificates.results || [];
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const expiringCerts = certs.filter((c: any) => {
      if (!c['valid-to']) return false;
      const expDate = new Date(c['valid-to']);
      return expDate < thirtyDaysFromNow;
    });
    
    checks.push({
      id: 'vpn-002',
      name: 'Certificados VPN',
      description: 'Verifica validade dos certificados SSL/TLS',
      category: 'Configuração VPN',
      status: expiringCerts.length > 0 ? 'warning' : 'pass',
      severity: 'high',
      recommendation: expiringCerts.length > 0
        ? 'Renovar certificados que expiram em breve'
        : 'Manter monitoramento de certificados',
      details: expiringCerts.length > 0
        ? `${expiringCerts.length} certificado(s) expira(m) nos próximos 30 dias`
        : 'Todos os certificados estão válidos',
    });
  } catch (error) {
    console.error('Error checking VPN:', error);
    checks.push({
      id: 'vpn-err',
      name: 'Erro ao verificar VPN',
      description: 'Não foi possível verificar configurações de VPN',
      category: 'Configuração VPN',
      status: 'pending',
      severity: 'high',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
  
  return checks;
}

// Verificar logging
async function checkLogging(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  
  try {
    const logSettings = await fortigateRequest(config, '/cmdb/log/setting');
    const settings = logSettings.results || {};
    
    const logEnabled = settings['log-invalid-packet'] === 'enable' || 
                       settings['resolve-ip'] === 'enable';
    
    checks.push({
      id: 'log-001',
      name: 'Log de Eventos',
      description: 'Verifica se logging está habilitado para eventos críticos',
      category: 'Logging e Monitoramento',
      status: logEnabled ? 'pass' : 'warning',
      severity: 'high',
      recommendation: !logEnabled
        ? 'Habilitar logging para eventos de segurança'
        : 'Manter configuração atual',
    });
    
    // Verificar syslog
    const syslogSettings = await fortigateRequest(config, '/cmdb/log.syslogd/setting');
    const syslog = syslogSettings.results || {};
    
    checks.push({
      id: 'log-002',
      name: 'Envio de Logs para SIEM',
      description: 'Verifica se logs são enviados para servidor syslog/SIEM',
      category: 'Logging e Monitoramento',
      status: syslog.status === 'enable' ? 'pass' : 'warning',
      severity: 'medium',
      recommendation: syslog.status !== 'enable'
        ? 'Configurar envio de logs para SIEM centralizado'
        : 'Manter configuração atual',
      details: syslog.status === 'enable'
        ? `Syslog configurado: ${syslog.server || 'N/A'}`
        : 'Syslog não configurado',
    });
  } catch (error) {
    console.error('Error checking logging:', error);
    checks.push({
      id: 'log-err',
      name: 'Erro ao verificar logging',
      description: 'Não foi possível verificar configurações de log',
      category: 'Logging e Monitoramento',
      status: 'pending',
      severity: 'medium',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
  
  return checks;
}

// Função para testar conectividade com o FortiGate
async function testFortiGateConnection(config: FortiGateConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${config.url}/api/v2/monitor/system/status`;
    console.log(`Testing connection to: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Connection test failed: ${response.status} - ${text}`);
      
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: 'API Key inválida ou sem permissões' };
      }
      if (response.status === 404) {
        return { success: false, error: 'Endpoint FortiGate não encontrado. Verifique a URL.' };
      }
      return { success: false, error: `Erro ${response.status}: ${text.substring(0, 100)}` };
    }

    // Verificar se a resposta é JSON válido
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return { success: false, error: 'Resposta inválida. O endereço não parece ser uma API FortiGate.' };
    }

    const data = await response.json();
    if (!data.results && !data.version) {
      return { success: false, error: 'Resposta não reconhecida como FortiGate' };
    }

    console.log('Connection test successful');
    return { success: true };
  } catch (error) {
    console.error('Connection test error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { success: false, error: 'Não foi possível conectar. Verifique se a URL está acessível.' };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao conectar' };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, apiKey } = await req.json();
    
    if (!url || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'URL e API Key são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato da URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    const config: FortiGateConfig = { url: normalizedUrl, apiKey: apiKey.trim() };
    
    console.log(`Starting compliance check for: ${config.url}`);
    
    // PRIMEIRO: Testar conectividade
    const connectionTest = await testFortiGateConnection(config);
    if (!connectionTest.success) {
      console.error('Connection test failed:', connectionTest.error);
      return new Response(
        JSON.stringify({ 
          error: 'Falha na conexão com FortiGate',
          details: connectionTest.error
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Executar todas as verificações em paralelo
    const [
      interfaceChecks,
      firewallChecks,
      adminChecks,
      utmChecks,
      haBackupChecks,
      firmwareChecks,
      vpnChecks,
      loggingChecks,
    ] = await Promise.all([
      checkInsecureProtocols(config),
      checkFirewallRules(config),
      checkAdminSecurity(config),
      checkUTMProfiles(config),
      checkHAAndBackup(config),
      checkFirmware(config),
      checkVPN(config),
      checkLogging(config),
    ]);
    
    const allChecks = [
      ...adminChecks,
      ...interfaceChecks,
      ...firewallChecks,
      ...utmChecks,
      ...haBackupChecks,
      ...vpnChecks,
      ...loggingChecks,
      ...firmwareChecks,
    ];
    
    const passed = allChecks.filter(c => c.status === 'pass').length;
    const failed = allChecks.filter(c => c.status === 'fail').length;
    const warnings = allChecks.filter(c => c.status === 'warning').length;
    
    const categories = [
      'Políticas de Segurança',
      'Segurança de Interfaces',
      'Configuração de Rede',
      'Regras de Entrada',
      'Perfis de Segurança UTM',
      'Alta Disponibilidade',
      'Backup e Recovery',
      'Configuração VPN',
      'Logging e Monitoramento',
      'Atualizações',
    ];
    
    const categoryData = categories.map(cat => {
      const catChecks = allChecks.filter(c => c.category === cat);
      const catPassed = catChecks.filter(c => c.status === 'pass').length;
      return {
        name: cat,
        icon: getCategoryIcon(cat),
        checks: catChecks,
        passRate: catChecks.length > 0 ? Math.round((catPassed / catChecks.length) * 100) : 100,
      };
    }).filter(cat => cat.checks.length > 0);
    
    const report = {
      overallScore: allChecks.length > 0 ? Math.round((passed / allChecks.length) * 100) : 0,
      totalChecks: allChecks.length,
      passed,
      failed,
      warnings,
      categories: categoryData,
      generatedAt: new Date().toISOString(),
    };
    
    console.log(`Compliance check completed: ${passed}/${allChecks.length} passed`);
    
    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fortigate-compliance function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro ao conectar com FortiGate',
        details: 'Verifique a URL e a API Key fornecidas'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'Políticas de Segurança': 'shield',
    'Segurança de Interfaces': 'monitor',
    'Configuração de Rede': 'network',
    'Regras de Entrada': 'arrowDownToLine',
    'Perfis de Segurança UTM': 'shieldCheck',
    'Alta Disponibilidade': 'serverCog',
    'Backup e Recovery': 'hardDrive',
    'Configuração VPN': 'lock',
    'Logging e Monitoramento': 'activity',
    'Atualizações': 'download',
  };
  return icons[category] || 'check';
}
