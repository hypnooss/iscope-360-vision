import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FortiGateConfig {
  url: string;
  apiKey: string;
}

interface EvidenceItem {
  label: string;
  value: string;
  type?: 'text' | 'code' | 'list' | 'json';
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
  evidence?: EvidenceItem[];
  rawData?: Record<string, unknown>;
  apiEndpoint?: string;
}

// Função customizada para fazer fetch ignorando SSL (FortiGates usam certificados auto-assinados)
async function fetchWithoutSSLVerification(url: string, options: RequestInit): Promise<Response> {
  // Criar um cliente HTTP que ignora verificação de certificado
  const client = Deno.createHttpClient({
    caCerts: [],
  });
  
  try {
    const response = await fetch(url, {
      ...options,
      // @ts-ignore - Deno permite passar client para ignorar SSL
      client,
    });
    return response;
  } finally {
    // Fechar o cliente após uso
    client.close();
  }
}

// Função para fazer requisição à API do FortiGate
async function fortigateRequest(config: FortiGateConfig, endpoint: string) {
  const url = `${config.url}/api/v2${endpoint}`;
  console.log(`Fetching: ${url}`);
  
  const response = await fetchWithoutSSLVerification(url, {
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
    
    const insecureHttpInterfaces: { name: string; allowaccess: string }[] = [];
    const insecureTelnetInterfaces: { name: string; allowaccess: string }[] = [];
    const sshWanInterfaces: { name: string; type: string; role: string; allowaccess: string }[] = [];
    const allInterfacesData: { name: string; allowaccess: string; type: string; role: string }[] = [];
    
    for (const iface of interfaces.results || []) {
      const allowAccess = iface.allowaccess || '';
      allInterfacesData.push({
        name: iface.name,
        allowaccess: allowAccess,
        type: iface.type || 'N/A',
        role: iface.role || 'N/A',
      });
      
      if (allowAccess.includes('http') && !allowAccess.includes('https')) {
        insecureHttpInterfaces.push({ name: iface.name, allowaccess: allowAccess });
      }
      if (allowAccess.includes('telnet')) {
        insecureTelnetInterfaces.push({ name: iface.name, allowaccess: allowAccess });
      }
      if (iface.type === 'physical' && iface.role === 'wan' && allowAccess.includes('ssh')) {
        sshWanInterfaces.push({ name: iface.name, type: iface.type, role: iface.role, allowaccess: allowAccess });
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
        ? `HTTP habilitado nas interfaces: ${insecureHttpInterfaces.map(i => i.name).join(', ')}`
        : 'Nenhuma interface com HTTP inseguro',
      apiEndpoint: '/api/v2/cmdb/system/interface',
      evidence: insecureHttpInterfaces.length > 0
        ? insecureHttpInterfaces.map(i => ({
            label: `Interface: ${i.name}`,
            value: `allowaccess: ${i.allowaccess}`,
            type: 'code' as const,
          }))
        : [{
            label: 'Interfaces analisadas',
            value: `${allInterfacesData.length} interfaces verificadas - nenhuma com HTTP inseguro`,
            type: 'text' as const,
          }],
      rawData: { interfaces: insecureHttpInterfaces.length > 0 ? insecureHttpInterfaces : allInterfacesData.slice(0, 5) },
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
        ? `Telnet habilitado nas interfaces: ${insecureTelnetInterfaces.map(i => i.name).join(', ')}`
        : 'Telnet desabilitado em todas as interfaces',
      apiEndpoint: '/api/v2/cmdb/system/interface',
      evidence: insecureTelnetInterfaces.length > 0
        ? insecureTelnetInterfaces.map(i => ({
            label: `Interface: ${i.name}`,
            value: `allowaccess: ${i.allowaccess}`,
            type: 'code' as const,
          }))
        : [{
            label: 'Interfaces analisadas',
            value: `${allInterfacesData.length} interfaces verificadas - nenhuma com Telnet`,
            type: 'text' as const,
          }],
      rawData: { interfaces: insecureTelnetInterfaces.length > 0 ? insecureTelnetInterfaces : allInterfacesData.slice(0, 5) },
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
        ? `SSH habilitado em interfaces WAN: ${sshWanInterfaces.map(i => i.name).join(', ')}`
        : 'SSH não exposto em interfaces WAN',
      apiEndpoint: '/api/v2/cmdb/system/interface',
      evidence: sshWanInterfaces.length > 0
        ? sshWanInterfaces.map(i => ({
            label: `Interface: ${i.name}`,
            value: `type: ${i.type}, role: ${i.role}, allowaccess: ${i.allowaccess}`,
            type: 'code' as const,
          }))
        : [{
            label: 'Interfaces WAN analisadas',
            value: `Nenhuma interface WAN com SSH exposto`,
            type: 'text' as const,
          }],
      rawData: { wanInterfaces: sshWanInterfaces },
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
      apiEndpoint: '/api/v2/cmdb/system/interface',
    });
  }
  
  return checks;
}

async function checkFirewallRules(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  
  try {
    const policies = await fortigateRequest(config, '/cmdb/firewall/policy');
    
    const anySourceRules: { id: string; name: string; srcaddr: string; srcintf: string }[] = [];
    const rdpExposed: { id: string; name: string; srcaddr: string; service: string }[] = [];
    const smbExposed: { id: string; name: string; srcaddr: string; service: string }[] = [];
    const anyAnyRules: { id: string; name: string; srcaddr: string; dstaddr: string }[] = [];
    const totalPoliciesData: { id: string; name: string; srcaddr: string; dstaddr: string; service: string }[] = [];
    
    for (const policy of policies.results || []) {
      const srcaddr = policy.srcaddr?.map((s: any) => s.name).join(',') || '';
      const dstaddr = policy.dstaddr?.map((d: any) => d.name).join(',') || '';
      const service = policy.service?.map((s: any) => s.name).join(',') || '';
      const srcintf = policy.srcintf?.map((i: any) => i.name).join(',') || '';
      
      totalPoliciesData.push({
        id: `#${policy.policyid}`,
        name: policy.name || 'Sem nome',
        srcaddr,
        dstaddr,
        service,
      });
      
      // Regras de entrada sem restrição
      if (srcaddr.includes('all') && srcintf.toLowerCase().includes('wan')) {
        anySourceRules.push({ id: `#${policy.policyid}`, name: policy.name || 'Sem nome', srcaddr, srcintf });
      }
      
      // RDP exposto
      if (service.toLowerCase().includes('rdp') || service.includes('3389')) {
        if (srcaddr.includes('all')) {
          rdpExposed.push({ id: `#${policy.policyid}`, name: policy.name || 'Sem nome', srcaddr, service });
        }
      }
      
      // SMB exposto
      if (service.toLowerCase().includes('smb') || service.includes('445') || service.includes('139')) {
        if (srcaddr.includes('all')) {
          smbExposed.push({ id: `#${policy.policyid}`, name: policy.name || 'Sem nome', srcaddr, service });
        }
      }
      
      // Regras any-any
      if (srcaddr.includes('all') && dstaddr.includes('all')) {
        anyAnyRules.push({ id: `#${policy.policyid}`, name: policy.name || 'Sem nome', srcaddr, dstaddr });
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
        ? `${anySourceRules.length} regras com source "all": ${anySourceRules.map(r => r.id).join(', ')}`
        : 'Todas as regras possuem origem restrita',
      apiEndpoint: '/api/v2/cmdb/firewall/policy',
      evidence: anySourceRules.length > 0
        ? anySourceRules.map(r => ({
            label: `Regra ${r.id}: ${r.name}`,
            value: `srcaddr: ${r.srcaddr}, srcintf: ${r.srcintf}`,
            type: 'code' as const,
          }))
        : [{
            label: 'Políticas analisadas',
            value: `${totalPoliciesData.length} regras verificadas - nenhuma com source "all" em interface WAN`,
            type: 'text' as const,
          }],
      rawData: { rules: anySourceRules.length > 0 ? anySourceRules : { total: totalPoliciesData.length } },
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
        ? `RDP exposto: ${rdpExposed.map(r => r.id).join(', ')}`
        : 'RDP não exposto para internet',
      apiEndpoint: '/api/v2/cmdb/firewall/policy',
      evidence: rdpExposed.length > 0
        ? rdpExposed.map(r => ({
            label: `Regra ${r.id}: ${r.name}`,
            value: `srcaddr: ${r.srcaddr}, service: ${r.service}`,
            type: 'code' as const,
          }))
        : [{
            label: 'Verificação RDP',
            value: `Nenhuma regra encontrada com RDP/3389 exposto para "all"`,
            type: 'text' as const,
          }],
      rawData: { rules: rdpExposed },
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
        ? `SMB exposto: ${smbExposed.map(r => r.id).join(', ')}`
        : 'SMB não exposto para internet',
      apiEndpoint: '/api/v2/cmdb/firewall/policy',
      evidence: smbExposed.length > 0
        ? smbExposed.map(r => ({
            label: `Regra ${r.id}: ${r.name}`,
            value: `srcaddr: ${r.srcaddr}, service: ${r.service}`,
            type: 'code' as const,
          }))
        : [{
            label: 'Verificação SMB',
            value: `Nenhuma regra encontrada com SMB/445/139 exposto para "all"`,
            type: 'text' as const,
          }],
      rawData: { rules: smbExposed },
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
        ? `${anyAnyRules.length} regras any-any: ${anyAnyRules.map(r => r.id).join(', ')}`
        : 'Nenhuma regra any-any encontrada',
      apiEndpoint: '/api/v2/cmdb/firewall/policy',
      evidence: anyAnyRules.length > 0
        ? anyAnyRules.map(r => ({
            label: `Regra ${r.id}: ${r.name}`,
            value: `srcaddr: ${r.srcaddr}, dstaddr: ${r.dstaddr}`,
            type: 'code' as const,
          }))
        : [{
            label: 'Verificação Any-Any',
            value: `${totalPoliciesData.length} regras verificadas - nenhuma com srcaddr="all" E dstaddr="all"`,
            type: 'text' as const,
          }],
      rawData: { rules: anyAnyRules.length > 0 ? anyAnyRules : { total: totalPoliciesData.length } },
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
      apiEndpoint: '/api/v2/cmdb/firewall/policy',
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
    const adminsWith2FA = adminList.filter((a: any) => a['two-factor'] !== 'disable');
    
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
      apiEndpoint: '/api/v2/cmdb/system/admin',
      evidence: adminsWithout2FA.length > 0
        ? adminsWithout2FA.map((a: any) => ({
            label: `Admin: ${a.name}`,
            value: `two-factor: ${a['two-factor'] || 'disable'}, accprofile: ${a.accprofile || 'N/A'}`,
            type: 'code' as const,
          }))
        : adminList.map((a: any) => ({
            label: `Admin: ${a.name}`,
            value: `two-factor: ${a['two-factor'] || 'N/A'}, accprofile: ${a.accprofile || 'N/A'}`,
            type: 'code' as const,
          })),
      rawData: { 
        totalAdmins: adminList.length,
        with2FA: adminsWith2FA.length,
        without2FA: adminsWithout2FA.length,
        admins: adminList.map((a: any) => ({ name: a.name, twoFactor: a['two-factor'], accprofile: a.accprofile })),
      },
    });
    
    // Timeout de sessão
    const adminTimeout = settings['admin-lockout-threshold'] || 0;
    const admintimeout = settings.admintimeout || 'N/A';
    
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
      apiEndpoint: '/api/v2/cmdb/system/global',
      evidence: [{
        label: 'Configuração de Timeout',
        value: `admin-lockout-threshold: ${adminTimeout}, admintimeout: ${admintimeout}`,
        type: 'code' as const,
      }],
      rawData: { 
        adminLockoutThreshold: adminTimeout,
        admintimeout,
      },
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
      apiEndpoint: '/api/v2/cmdb/system/global',
      evidence: [{
        label: 'Configuração de Criptografia',
        value: `strong-crypto: ${settings['strong-crypto'] || 'disable'}`,
        type: 'code' as const,
      }],
      rawData: { 
        strongCrypto: settings['strong-crypto'],
        sslMinProtoVersion: settings['ssl-min-proto-version'],
      },
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
      apiEndpoint: '/api/v2/cmdb/system/admin',
    });
  }
  
  return checks;
}

// Verificar configurações UTM (IPS, Web Filter, App Control)
async function checkUTMProfiles(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  
  try {
    // Buscar interfaces para identificar WAN e SDWAN
    const interfaces = await fortigateRequest(config, '/cmdb/system/interface');
    const sdwanZones = await fortigateRequest(config, '/cmdb/system/sdwan').catch(() => ({ results: [] }));
    
    // Identificar interfaces de saída para internet (WAN ou SDWAN)
    const wanInterfaces = new Set<string>();
    const sdwanInterfaceNames = new Set<string>();
    
    // Interfaces com role WAN
    for (const iface of interfaces.results || []) {
      if (iface.role === 'wan') {
        wanInterfaces.add(iface.name);
      }
    }
    
    // Interfaces do SDWAN (membros e zones)
    const sdwanConfig = sdwanZones.results || {};
    const sdwanMembers = sdwanConfig.members || [];
    for (const member of sdwanMembers) {
      if (member.interface) {
        sdwanInterfaceNames.add(member.interface);
        wanInterfaces.add(member.interface);
      }
    }
    
    // Zones SDWAN
    const sdwanZoneList = sdwanConfig.zone || [];
    for (const zone of sdwanZoneList) {
      if (zone.name) {
        wanInterfaces.add(zone.name);
      }
    }
    
    // Também incluir "virtual-wan-link" usado em versões antigas
    wanInterfaces.add('virtual-wan-link');
    
    console.log('WAN/SDWAN interfaces identificadas:', Array.from(wanInterfaces));
    
    // IPS
    const ipsProfiles = await fortigateRequest(config, '/cmdb/ips/sensor');
    const policies = await fortigateRequest(config, '/cmdb/firewall/policy');
    
    const allPolicies = policies.results || [];
    const totalPolicies = allPolicies.length;
    
    // Filtrar políticas de saída para internet (destino WAN/SDWAN)
    const internetOutboundPolicies = allPolicies.filter((p: any) => {
      const dstintf = p.dstintf?.map((i: any) => i.name) || [];
      return dstintf.some((ifname: string) => wanInterfaces.has(ifname));
    });
    
    const totalInternetPolicies = internetOutboundPolicies.length;
    
    console.log(`Políticas de saída internet: ${totalInternetPolicies} de ${totalPolicies} total`);
    
    // IPS - considera todas as políticas (entrada e saída)
    const policiesWithIPS = allPolicies.filter((p: any) => p['ips-sensor']);
    const policiesWithoutIPS = allPolicies.filter((p: any) => !p['ips-sensor']);
    
    const ipsStatus = policiesWithIPS.length === 0 ? 'fail' : 
                      policiesWithIPS.length < totalPolicies * 0.7 ? 'warning' : 'pass';
    
    checks.push({
      id: 'utm-001',
      name: 'Perfil IPS/IDS Ativo',
      description: 'Verifica se perfis de Intrusion Prevention estão aplicados nas políticas',
      category: 'Perfis de Segurança UTM',
      status: ipsStatus,
      severity: 'high',
      recommendation: policiesWithIPS.length < totalPolicies
        ? 'Aplicar perfil IPS em todas as regras de tráfego de entrada'
        : 'Manter configuração atual',
      details: `IPS aplicado em ${policiesWithIPS.length} de ${totalPolicies} políticas`,
      apiEndpoint: '/api/v2/cmdb/firewall/policy',
      evidence: [
        { label: 'Com IPS', value: policiesWithIPS.map((p: any) => `#${p.policyid}: ${p.name || 'Sem nome'} (${p['ips-sensor']})`).join(', ') || 'Nenhuma', type: 'text' as const },
        { label: 'Sem IPS', value: policiesWithoutIPS.slice(0, 5).map((p: any) => `#${p.policyid}: ${p.name || 'Sem nome'}`).join(', ') || 'Nenhuma', type: 'text' as const },
      ],
      rawData: { 
        total: totalPolicies,
        withIPS: policiesWithIPS.length,
        ipsProfiles: (ipsProfiles.results || []).map((p: any) => p.name),
      },
    });
    
    // Web Filter - APENAS políticas de saída para internet (WAN/SDWAN)
    const internetPoliciesWithWebFilter = internetOutboundPolicies.filter((p: any) => p['webfilter-profile']);
    const internetPoliciesWithoutWebFilter = internetOutboundPolicies.filter((p: any) => !p['webfilter-profile']);
    
    const webFilterStatus = totalInternetPolicies === 0 ? 'pass' :
                            internetPoliciesWithWebFilter.length === 0 ? 'fail' :
                            internetPoliciesWithWebFilter.length < totalInternetPolicies * 0.5 ? 'warning' : 'pass';
    
    checks.push({
      id: 'utm-004',
      name: 'Web Filter Ativo',
      description: 'Verifica se filtro de conteúdo web está aplicado nas políticas de saída para internet (WAN/SDWAN)',
      category: 'Perfis de Segurança UTM',
      status: webFilterStatus,
      severity: 'medium',
      recommendation: internetPoliciesWithWebFilter.length < totalInternetPolicies
        ? 'Aplicar Web Filter em todas as políticas de acesso à internet'
        : 'Manter configuração atual',
      details: `Web Filter aplicado em ${internetPoliciesWithWebFilter.length} de ${totalInternetPolicies} políticas de saída internet`,
      apiEndpoint: '/api/v2/cmdb/firewall/policy',
      evidence: [
        { label: 'Interfaces WAN/SDWAN', value: Array.from(wanInterfaces).join(', ') || 'Nenhuma identificada', type: 'text' as const },
        { label: 'Com WebFilter', value: internetPoliciesWithWebFilter.map((p: any) => `#${p.policyid}: ${p['webfilter-profile']}`).join(', ') || 'Nenhuma', type: 'text' as const },
        { label: 'Sem WebFilter', value: internetPoliciesWithoutWebFilter.slice(0, 5).map((p: any) => `#${p.policyid}: ${p.name || 'Sem nome'}`).join(', ') || 'Nenhuma', type: 'text' as const },
      ],
      rawData: { 
        total: totalPolicies,
        internetPolicies: totalInternetPolicies,
        withWebFilter: internetPoliciesWithWebFilter.length,
        wanInterfaces: Array.from(wanInterfaces),
      },
    });
    
    // Application Control - APENAS políticas de saída para internet (WAN/SDWAN)
    const internetPoliciesWithAppCtrl = internetOutboundPolicies.filter((p: any) => p['application-list']);
    const internetPoliciesWithoutAppCtrl = internetOutboundPolicies.filter((p: any) => !p['application-list']);
    
    const appCtrlStatus = totalInternetPolicies === 0 ? 'pass' :
                          internetPoliciesWithAppCtrl.length === 0 ? 'fail' :
                          internetPoliciesWithAppCtrl.length < totalInternetPolicies * 0.5 ? 'warning' : 'pass';
    
    checks.push({
      id: 'utm-007',
      name: 'Application Control Ativo',
      description: 'Verifica se controle de aplicações está aplicado nas políticas de saída para internet (WAN/SDWAN)',
      category: 'Perfis de Segurança UTM',
      status: appCtrlStatus,
      severity: 'medium',
      recommendation: internetPoliciesWithAppCtrl.length < totalInternetPolicies
        ? 'Aplicar Application Control para visibilidade e controle de aplicações de internet'
        : 'Manter configuração atual',
      details: `Application Control aplicado em ${internetPoliciesWithAppCtrl.length} de ${totalInternetPolicies} políticas de saída internet`,
      apiEndpoint: '/api/v2/cmdb/firewall/policy',
      evidence: [
        { label: 'Interfaces WAN/SDWAN', value: Array.from(wanInterfaces).join(', ') || 'Nenhuma identificada', type: 'text' as const },
        { label: 'Com AppControl', value: internetPoliciesWithAppCtrl.map((p: any) => `#${p.policyid}: ${p['application-list']}`).join(', ') || 'Nenhuma', type: 'text' as const },
        { label: 'Sem AppControl', value: internetPoliciesWithoutAppCtrl.slice(0, 5).map((p: any) => `#${p.policyid}: ${p.name || 'Sem nome'}`).join(', ') || 'Nenhuma', type: 'text' as const },
      ],
      rawData: { 
        total: totalPolicies,
        internetPolicies: totalInternetPolicies,
        withAppControl: internetPoliciesWithAppCtrl.length,
        wanInterfaces: Array.from(wanInterfaces),
      },
    });
    
    // Antivírus
    const policiesWithAV = (policies.results || []).filter((p: any) => p['av-profile']);
    const policiesWithoutAV = (policies.results || []).filter((p: any) => !p['av-profile']);
    
    checks.push({
      id: 'utm-009',
      name: 'Antivírus de Gateway',
      description: 'Verifica se antivírus está habilitado para escanear arquivos',
      category: 'Perfis de Segurança UTM',
      status: policiesWithAV.length < totalPolicies * 0.5 ? 'warning' : 'pass',
      severity: 'high',
      recommendation: policiesWithAV.length < totalPolicies
        ? 'Aplicar perfil de antivírus em todas as políticas'
        : 'Manter configuração atual',
      details: `Antivírus aplicado em ${policiesWithAV.length} de ${totalPolicies} políticas`,
      apiEndpoint: '/api/v2/cmdb/firewall/policy',
      evidence: [
        { label: 'Com Antivírus', value: policiesWithAV.map((p: any) => `#${p.policyid}: ${p['av-profile']}`).join(', ') || 'Nenhuma', type: 'text' as const },
        { label: 'Sem Antivírus', value: policiesWithoutAV.slice(0, 5).map((p: any) => `#${p.policyid}: ${p.name || 'Sem nome'}`).join(', ') || 'Nenhuma', type: 'text' as const },
      ],
      rawData: { 
        total: totalPolicies,
        withAV: policiesWithAV.length,
      },
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
      apiEndpoint: '/api/v2/cmdb/firewall/policy',
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
    const haGroupName = haSettings['group-name'] || 'N/A';
    const haPriority = haSettings.priority || 'N/A';
    const haSchedule = haSettings.schedule || 'N/A';
    
    checks.push({
      id: 'ha-001',
      name: 'Cluster HA Configurado',
      description: 'Verifica se alta disponibilidade está configurada',
      category: 'Alta Disponibilidade',
      status: haMode === 'standalone' ? 'warning' : 'pass',
      severity: 'medium',
      recommendation: haMode === 'standalone'
        ? 'Considerar configurar HA para alta disponibilidade'
        : 'Manter configuração atual',
      details: `Modo HA: ${haMode}`,
      apiEndpoint: '/api/v2/cmdb/system/ha',
      evidence: [
        { label: 'Modo HA', value: haMode, type: 'text' as const },
        { label: 'Nome do Grupo', value: haGroupName, type: 'text' as const },
        { label: 'Prioridade', value: String(haPriority), type: 'text' as const },
        { label: 'Schedule', value: haSchedule, type: 'text' as const },
      ],
      rawData: {
        mode: haMode,
        groupName: haGroupName,
        priority: haPriority,
        schedule: haSchedule,
        override: haSettings.override,
        encryption: haSettings.encryption,
      },
    });
    
    if (haMode !== 'standalone') {
      const hbInterfaces = haSettings['hbdev'] || '';
      const hbInterfaceList = hbInterfaces.split(' ').filter((i: string) => i.trim());
      
      checks.push({
        id: 'ha-003',
        name: 'Heartbeat HA',
        description: 'Verifica configuração dos links de heartbeat',
        category: 'Alta Disponibilidade',
        status: hbInterfaceList.length < 2 ? 'warning' : 'pass',
        severity: 'high',
        recommendation: 'Configurar múltiplos links de heartbeat para redundância',
        details: `Interfaces de heartbeat: ${hbInterfaces || 'Nenhuma configurada'}`,
        apiEndpoint: '/api/v2/cmdb/system/ha',
        evidence: [
          { label: 'Interfaces Heartbeat', value: hbInterfaces || 'Nenhuma', type: 'code' as const },
          { label: 'Quantidade', value: `${hbInterfaceList.length} interface(s)`, type: 'text' as const },
        ],
        rawData: {
          hbdev: hbInterfaces,
          interfaceCount: hbInterfaceList.length,
        },
      });
    }
    
    // Backup - verificar configuração de auto-backup
    try {
      const autoBackup = await fortigateRequest(config, '/cmdb/system/auto-script');
      const allScripts = autoBackup.results || [];
      const backupScripts = allScripts.filter((s: any) => 
        s.script?.toLowerCase().includes('backup') || s.name?.toLowerCase().includes('backup')
      );
      
      checks.push({
        id: 'bkp-001',
        name: 'Backup Automático Configurado',
        description: 'Verifica se backup automático de configuração está habilitado',
        category: 'Backup e Recovery',
        status: backupScripts.length === 0 ? 'fail' : 'pass',
        severity: 'high',
        recommendation: backupScripts.length === 0
          ? 'Configurar backup automático para servidor TFTP/SCP ou FortiManager'
          : 'Manter configuração atual',
        details: backupScripts.length > 0
          ? `${backupScripts.length} script(s) de backup configurado(s)`
          : 'Nenhum backup automático configurado',
        apiEndpoint: '/api/v2/cmdb/system/auto-script',
        evidence: backupScripts.length > 0
          ? backupScripts.map((s: any) => ({
              label: `Script: ${s.name}`,
              value: `interval: ${s.interval || 'N/A'}, start: ${s.start || 'N/A'}`,
              type: 'code' as const,
            }))
          : [{
              label: 'Scripts encontrados',
              value: allScripts.length > 0 
                ? `${allScripts.length} script(s) encontrado(s), nenhum relacionado a backup`
                : 'Nenhum auto-script configurado',
              type: 'text' as const,
            }],
        rawData: {
          totalScripts: allScripts.length,
          backupScripts: backupScripts.map((s: any) => ({ name: s.name, interval: s.interval })),
        },
      });
    } catch {
      checks.push({
        id: 'bkp-001',
        name: 'Backup Automático Configurado',
        description: 'Verifica se backup automático de configuração está habilitado',
        category: 'Backup e Recovery',
        status: 'warning',
        severity: 'high',
        recommendation: 'Verificar configuração de backup manualmente',
        details: 'Não foi possível verificar configuração de auto-backup',
        apiEndpoint: '/api/v2/cmdb/system/auto-script',
        evidence: [{
          label: 'Status',
          value: 'Endpoint não disponível ou sem permissão',
          type: 'text' as const,
        }],
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
      apiEndpoint: '/api/v2/cmdb/system/ha',
    });
  }
  
  return checks;
}

// Versões recomendadas pela Fortinet (atualizado em Dezembro 2025)
// Fonte: https://community.fortinet.com/t5/FortiGate/Technical-Tip-Recommended-Release-for-FortiOS/ta-p/227178
const FORTINET_RECOMMENDED_VERSIONS: Record<string, string> = {
  // Versão recomendada geral para a maioria dos modelos modernos
  'default': '7.4.8',
  // Modelos Low End antigos
  'FortiGate-30E': '6.2.16',
  'FortiWiFi-30E': '6.2.16',
  'FortiGate-50E': '6.2.16',
  'FortiWiFi-50E': '6.2.16',
  'FortiGate-51E': '6.2.16',
  'FortiGate-52E': '6.2.16',
  'FortiGate-98D': '6.0.18',
  'FortiGate-240D': '6.0.18',
  'FortiGate-280D': '6.0.18',
  // Mid Range antigos
  'FortiGate-100E': '7.2.11',
  'FortiGate-101E': '7.2.11',
  // High End antigos
  'FortiGate-1200D': '7.0.17',
  'FortiGate-1500D': '7.2.11',
  'FortiGate-1500DT': '7.2.11',
};

// Função para extrair versão numérica do FortiOS (ex: "v7.4.8" -> "7.4.8")
function extractVersion(versionString: string): string {
  const match = versionString.match(/v?(\d+\.\d+\.\d+)/i);
  return match ? match[1] : versionString;
}

// Função para comparar versões semânticas
function compareVersions(current: string, recommended: string): 'up-to-date' | 'outdated' | 'unknown' {
  try {
    const currentParts = current.split('.').map(Number);
    const recommendedParts = recommended.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      const c = currentParts[i] || 0;
      const r = recommendedParts[i] || 0;
      if (c > r) return 'up-to-date';
      if (c < r) return 'outdated';
    }
    return 'up-to-date';
  } catch {
    return 'unknown';
  }
}

// Verificar firmware e atualizações
async function checkFirmware(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  
  try {
    // Buscar informações de múltiplos endpoints
    const [systemStatus, globalSettings] = await Promise.all([
      fortigateRequest(config, '/monitor/system/status'),
      fortigateRequest(config, '/cmdb/system/global'),
    ]);
    
    // A API /monitor/system/status pode retornar dados em 'results' ou diretamente
    const status = systemStatus.results || systemStatus || {};
    const global = globalSettings.results || {};
    
    console.log('System status response:', JSON.stringify(status, null, 2));
    console.log('Global settings response:', JSON.stringify(global, null, 2));
    
    // Tentar obter a versão de múltiplas fontes
    // 1. Primeiro tenta do /monitor/system/status
    // 2. Depois tenta do /cmdb/system/global (campo version)
    // 3. Tenta do campo 'current_version' ou 'fos_version'
    const rawVersion = status.version || 
                       status.current_version || 
                       status.fos_version ||
                       global.version ||
                       '';
    
    // Extrair a versão do hostname se contiver padrão de versão (backup)
    let currentVersion = extractVersion(rawVersion);
    
    // Se não encontrou, tentar buscar via firmware status
    if (!currentVersion) {
      try {
        const firmwareStatus = await fortigateRequest(config, '/monitor/system/firmware');
        const fw = firmwareStatus.results || firmwareStatus || {};
        console.log('Firmware status response:', JSON.stringify(fw, null, 2));
        if (fw.current && fw.current.version) {
          currentVersion = extractVersion(fw.current.version);
        }
      } catch (fwErr) {
        console.log('Could not fetch firmware status:', fwErr);
      }
    }
    
    currentVersion = currentVersion || 'Desconhecida';
    
    // Buscar serial de múltiplos campos possíveis
    const serial = status.serial || status.serial_number || status.sn || global.serial || '';
    const hostname = status.hostname || global.hostname || '';
    const model = status.model_name || status.model || global.model || '';
    
    // Uptime pode vir em diferentes formatos: segundos, string formatada, ou objeto
    let uptimeStr = '';
    if (status.uptime !== undefined && status.uptime !== null) {
      if (typeof status.uptime === 'number') {
        // Converter segundos para formato legível
        const days = Math.floor(status.uptime / 86400);
        const hours = Math.floor((status.uptime % 86400) / 3600);
        const minutes = Math.floor((status.uptime % 3600) / 60);
        uptimeStr = days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
      } else {
        uptimeStr = String(status.uptime);
      }
    }
    
    // Determinar versão recomendada com base no modelo
    const recommendedVersion = FORTINET_RECOMMENDED_VERSIONS[model] || FORTINET_RECOMMENDED_VERSIONS['default'];
    const versionStatus = compareVersions(currentVersion, recommendedVersion);
    
    let checkStatus: 'pass' | 'fail' | 'warning' = 'pass';
    let recommendation = 'Firmware está atualizado conforme recomendação Fortinet';
    let details = `Versão atual: FortiOS ${currentVersion} | Recomendada: ${recommendedVersion}`;
    
    if (versionStatus === 'outdated') {
      checkStatus = 'fail';
      recommendation = `Atualizar para FortiOS ${recommendedVersion} conforme recomendação Fortinet (Dezembro 2025)`;
      details = `Versão DESATUALIZADA: FortiOS ${currentVersion} → Recomendada: ${recommendedVersion}`;
    } else if (versionStatus === 'unknown') {
      checkStatus = 'warning';
      recommendation = 'Não foi possível comparar versões. Verificar manualmente no suporte Fortinet';
      details = `Versão atual: ${rawVersion || 'Não identificada'}`;
    }
    
    // Montar evidence - Serial Number sempre aparece
    const evidence: EvidenceItem[] = [
      { label: 'Versão FortiOS Atual', value: currentVersion || rawVersion || 'Não identificada', type: 'text' as const },
      { label: 'Versão Recomendada Fortinet', value: recommendedVersion, type: 'text' as const },
      { label: 'Status', value: versionStatus === 'up-to-date' ? '✅ Atualizado' : versionStatus === 'outdated' ? '❌ Desatualizado' : '⚠️ Verificar manualmente', type: 'text' as const },
      { label: 'Modelo', value: model || 'Não identificado', type: 'text' as const },
      { label: 'Hostname', value: hostname || 'Não identificado', type: 'text' as const },
      { label: 'Serial Number', value: serial || 'Não identificado', type: 'code' as const },
    ];
    
    if (uptimeStr) evidence.push({ label: 'Uptime', value: uptimeStr, type: 'text' as const });
    evidence.push({ label: 'Fonte da recomendação', value: 'Fortinet Community - Technical Tip (Dezembro 2025)', type: 'text' as const });
    
    checks.push({
      id: 'upd-001',
      name: 'Versão do Firmware',
      description: 'Verifica se o firmware está na versão recomendada pela Fortinet',
      category: 'Atualizações',
      status: checkStatus,
      severity: 'high',
      details,
      recommendation,
      apiEndpoint: '/api/v2/monitor/system/status',
      evidence,
      rawData: {
        version: currentVersion,
        rawVersion,
        recommendedVersion,
        versionStatus,
        serial,
        hostname,
        model,
        uptime: uptimeStr,
        source: 'https://community.fortinet.com/t5/FortiGate/Technical-Tip-Recommended-Release-for-FortiOS/ta-p/227178',
      },
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
      apiEndpoint: '/api/v2/monitor/system/status',
    });
  }
  
  return checks;
}

// Verificar Licenças FortiGuard e Suporte
async function checkFortiGuardLicenses(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  
  try {
    // Buscar status das licenças FortiGuard
    const licenseStatus = await fortigateRequest(config, '/monitor/license/status');
    const licenses = licenseStatus.results || licenseStatus || {};
    
    console.log('License status response:', JSON.stringify(licenses, null, 2));
    
    // Mapear nomes de serviços para exibição
    const serviceNames: Record<string, string> = {
      'forticare': 'FortiCare Support',
      'fortiguard': 'FortiGuard Services',
      'antivirus': 'Antivírus',
      'ips': 'IPS (Intrusion Prevention)',
      'webfilter': 'Web Filter',
      'appctrl': 'Application Control',
      'antispam': 'AntiSpam',
      'industrial_db': 'Industrial Database',
      'security_rating': 'Security Rating',
      'botnet_domain': 'Botnet Domain',
      'botnet_ip': 'Botnet IP',
      'malicious_urls': 'Malicious URLs',
      'mobile_malware': 'Mobile Malware',
      'outbreak_prevention': 'Outbreak Prevention',
      'device_os_id': 'Device/OS Identification',
      'fsa_sandbox': 'FortiSandbox Cloud',
      'fsae': 'FortiSandbox',
      'faz_cloud': 'FortiAnalyzer Cloud',
      'fgd_wf': 'FortiGuard Web Filter',
    };
    
    // Verificar FortiCare/Suporte
    const forticareInfo = licenses.forticare || licenses.support || {};
    const supportStatus = forticareInfo.status || forticareInfo.entitlement || 'unknown';
    const supportExpiry = forticareInfo.expires || forticareInfo.expiry_date || '';
    
    let supportActive = false;
    let supportDaysRemaining = 0;
    let supportExpiryDate = '';
    
    if (supportExpiry) {
      const expiryDate = new Date(supportExpiry * 1000); // Unix timestamp
      supportExpiryDate = expiryDate.toLocaleDateString('pt-BR');
      supportDaysRemaining = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      supportActive = supportDaysRemaining > 0;
    } else if (supportStatus === 'licensed' || supportStatus === 'valid' || supportStatus === 'active') {
      supportActive = true;
    }
    
    let supportCheckStatus: 'pass' | 'fail' | 'warning' = 'pass';
    let supportDetails = 'Suporte FortiCare ativo';
    let supportRecommendation = 'Manter contrato de suporte ativo';
    
    if (!supportActive) {
      supportCheckStatus = 'fail';
      supportDetails = 'Suporte FortiCare EXPIRADO ou não identificado';
      supportRecommendation = 'Renovar contrato FortiCare imediatamente para ter acesso a atualizações e suporte técnico';
    } else if (supportDaysRemaining > 0 && supportDaysRemaining <= 30) {
      supportCheckStatus = 'warning';
      supportDetails = `Suporte FortiCare expira em ${supportDaysRemaining} dias (${supportExpiryDate})`;
      supportRecommendation = 'Renovar contrato FortiCare antes da expiração';
    } else if (supportDaysRemaining > 30) {
      supportDetails = `Suporte FortiCare ativo até ${supportExpiryDate} (${supportDaysRemaining} dias restantes)`;
    }
    
    const supportEvidence: EvidenceItem[] = [
      { label: 'Status', value: supportActive ? '✅ Ativo' : '❌ Expirado/Inativo', type: 'text' as const },
    ];
    if (supportExpiryDate) {
      supportEvidence.push({ label: 'Data de Expiração', value: supportExpiryDate, type: 'text' as const });
      supportEvidence.push({ label: 'Dias Restantes', value: supportDaysRemaining > 0 ? String(supportDaysRemaining) : 'Expirado', type: 'text' as const });
    }
    
    checks.push({
      id: 'lic-001',
      name: 'Suporte FortiCare',
      description: 'Verifica se o contrato de suporte FortiCare está ativo',
      category: 'Licenciamento',
      status: supportCheckStatus,
      severity: 'critical',
      details: supportDetails,
      recommendation: supportRecommendation,
      apiEndpoint: '/api/v2/monitor/license/status',
      evidence: supportEvidence,
      rawData: { forticare: forticareInfo, daysRemaining: supportDaysRemaining },
    });
    
    // Verificar licenças de segurança FortiGuard
    const securityServices = ['antivirus', 'ips', 'webfilter', 'appctrl', 'antispam'];
    const activeServices: string[] = [];
    const expiredServices: string[] = [];
    const expiringServices: string[] = [];
    const licenseEvidence: EvidenceItem[] = [];
    
    for (const service of securityServices) {
      const serviceInfo = licenses[service] || {};
      const status = serviceInfo.status || serviceInfo.entitlement || 'unknown';
      const expiry = serviceInfo.expires || serviceInfo.expiry_date || 0;
      const serviceName = serviceNames[service] || service;
      
      let isActive = false;
      let daysRemaining = 0;
      let expiryDateStr = '';
      
      if (expiry) {
        const expiryDate = new Date(expiry * 1000);
        expiryDateStr = expiryDate.toLocaleDateString('pt-BR');
        daysRemaining = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        isActive = daysRemaining > 0;
      } else if (status === 'licensed' || status === 'valid' || status === 'active') {
        isActive = true;
      }
      
      if (isActive) {
        if (daysRemaining > 0 && daysRemaining <= 30) {
          expiringServices.push(serviceName);
          licenseEvidence.push({ 
            label: serviceName, 
            value: `⚠️ Expira em ${daysRemaining} dias (${expiryDateStr})`, 
            type: 'text' as const 
          });
        } else {
          activeServices.push(serviceName);
          licenseEvidence.push({ 
            label: serviceName, 
            value: expiryDateStr ? `✅ Ativo até ${expiryDateStr}` : '✅ Ativo', 
            type: 'text' as const 
          });
        }
      } else {
        expiredServices.push(serviceName);
        licenseEvidence.push({ 
          label: serviceName, 
          value: '❌ Expirado/Inativo', 
          type: 'text' as const 
        });
      }
    }
    
    let licenseCheckStatus: 'pass' | 'fail' | 'warning' = 'pass';
    let licenseDetails = `${activeServices.length + expiringServices.length} de ${securityServices.length} serviços FortiGuard ativos`;
    let licenseRecommendation = 'Manter todas as licenças FortiGuard atualizadas';
    
    if (expiredServices.length > 0) {
      licenseCheckStatus = 'fail';
      licenseDetails = `${expiredServices.length} serviços FortiGuard expirados: ${expiredServices.join(', ')}`;
      licenseRecommendation = 'Renovar licenças FortiGuard expiradas para manter proteção ativa';
    } else if (expiringServices.length > 0) {
      licenseCheckStatus = 'warning';
      licenseDetails = `${expiringServices.length} serviços expirando em breve: ${expiringServices.join(', ')}`;
      licenseRecommendation = 'Renovar licenças FortiGuard antes da expiração';
    }
    
    checks.push({
      id: 'lic-002',
      name: 'Licenças FortiGuard',
      description: 'Verifica status das licenças de segurança FortiGuard (AV, IPS, WebFilter, AppControl)',
      category: 'Licenciamento',
      status: licenseCheckStatus,
      severity: 'high',
      details: licenseDetails,
      recommendation: licenseRecommendation,
      apiEndpoint: '/api/v2/monitor/license/status',
      evidence: licenseEvidence,
      rawData: { 
        active: activeServices, 
        expired: expiredServices, 
        expiring: expiringServices,
        licenses 
      },
    });
    
  } catch (error) {
    console.error('Error checking licenses:', error);
    checks.push({
      id: 'lic-err',
      name: 'Erro ao verificar licenças',
      description: 'Não foi possível verificar o status das licenças',
      category: 'Licenciamento',
      status: 'pending',
      severity: 'high',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
      apiEndpoint: '/api/v2/monitor/license/status',
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
    
    const strongCrypto = vpnPhase1.filter((v: any) => {
      const proposal = v.proposal || '';
      return !proposal.includes('des') && !proposal.includes('md5');
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
      apiEndpoint: '/api/v2/cmdb/vpn.ipsec/phase1-interface',
      evidence: vpnPhase1.length > 0
        ? vpnPhase1.map((v: any) => ({
            label: `VPN: ${v.name}`,
            value: `proposal: ${v.proposal || 'N/A'}, ike-version: ${v['ike-version'] || 'N/A'}, dhgrp: ${v.dhgrp || 'N/A'}`,
            type: 'code' as const,
          }))
        : [{
            label: 'VPNs IPSec',
            value: 'Nenhuma VPN IPSec configurada',
            type: 'text' as const,
          }],
      rawData: {
        total: vpnPhase1.length,
        withWeakCrypto: weakCrypto.length,
        withStrongCrypto: strongCrypto.length,
        vpns: vpnPhase1.map((v: any) => ({ name: v.name, proposal: v.proposal, ikeVersion: v['ike-version'] })),
      },
    });
    
    // Verificar certificado SSL VPN
    try {
      const sslvpnSettings = await fortigateRequest(config, '/cmdb/vpn.ssl/settings');
      const sslvpn = sslvpnSettings.results || {};
      const sslCertName = sslvpn['servercert'] || sslvpn['server-cert'] || '';
      
      // Buscar detalhes do certificado usado pelo SSL VPN
      let sslCertValid = false;
      let sslCertDetails = 'Certificado não identificado';
      let certEvidence: EvidenceItem[] = [];
      
      if (sslCertName && sslCertName !== 'Fortinet_Factory') {
        // Certificado customizado configurado
        sslCertValid = true;
        sslCertDetails = `Certificado customizado: ${sslCertName}`;
        certEvidence = [
          { label: 'Certificado SSL VPN', value: sslCertName, type: 'code' as const },
          { label: 'Status', value: '✅ Usando certificado customizado (não é Fortinet_Factory)', type: 'text' as const },
        ];
      } else if (sslCertName === 'Fortinet_Factory') {
        sslCertValid = false;
        sslCertDetails = 'Usando certificado padrão de fábrica (Fortinet_Factory)';
        certEvidence = [
          { label: 'Certificado SSL VPN', value: 'Fortinet_Factory', type: 'code' as const },
          { label: 'Status', value: '❌ Certificado padrão de fábrica - não confiável por navegadores', type: 'text' as const },
        ];
      } else {
        sslCertDetails = 'Não foi possível identificar o certificado configurado';
        certEvidence = [
          { label: 'Certificado SSL VPN', value: 'Não identificado', type: 'text' as const },
        ];
      }
      
      checks.push({
        id: 'vpn-002',
        name: 'Certificado SSL VPN',
        description: 'Verifica se SSL VPN usa um certificado válido (não padrão de fábrica)',
        category: 'Configuração VPN',
        status: sslCertValid ? 'pass' : 'fail',
        severity: 'high',
        recommendation: !sslCertValid
          ? 'Substituir certificado Fortinet_Factory por um certificado válido de uma CA confiável'
          : 'Manter configuração atual',
        details: sslCertDetails,
        apiEndpoint: '/api/v2/cmdb/vpn.ssl/settings',
        evidence: certEvidence,
        rawData: {
          servercert: sslCertName,
          sslvpnSettings: sslvpn,
        },
      });
    } catch {
      checks.push({
        id: 'vpn-002',
        name: 'Certificado SSL VPN',
        description: 'Verifica se SSL VPN usa um certificado válido',
        category: 'Configuração VPN',
        status: 'warning',
        severity: 'high',
        recommendation: 'Verificar configuração SSL VPN manualmente',
        details: 'Não foi possível verificar configuração SSL VPN',
        apiEndpoint: '/api/v2/cmdb/vpn.ssl/settings',
        evidence: [{
          label: 'Status',
          value: 'Endpoint não disponível ou SSL VPN não configurado',
          type: 'text' as const,
        }],
      });
    }
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
      apiEndpoint: '/api/v2/cmdb/vpn.ipsec/phase1-interface',
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
    
    const logInvalidPacket = settings['log-invalid-packet'] || 'disable';
    const resolveIp = settings['resolve-ip'] || 'disable';
    const logUserInfo = settings['log-user-in-upper'] || 'disable';
    const briefTrafficFormat = settings['brief-traffic-format'] || 'disable';
    
    const logEnabled = logInvalidPacket === 'enable' || resolveIp === 'enable';
    
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
      apiEndpoint: '/api/v2/cmdb/log/setting',
      evidence: [
        { label: 'log-invalid-packet', value: logInvalidPacket, type: 'code' as const },
        { label: 'resolve-ip', value: resolveIp, type: 'code' as const },
        { label: 'log-user-in-upper', value: logUserInfo, type: 'code' as const },
        { label: 'brief-traffic-format', value: briefTrafficFormat, type: 'code' as const },
      ],
      rawData: {
        logInvalidPacket,
        resolveIp,
        logUserInfo,
        briefTrafficFormat,
        fwpolicyImplicitLog: settings['fwpolicy-implicit-log'],
        fwpolicy6ImplicitLog: settings['fwpolicy6-implicit-log'],
      },
    });
    
    // Verificar FortiAnalyzer
    let fortiAnalyzerEnabled = false;
    let fortiAnalyzerServer = 'N/A';
    let fortiAnalyzerEvidence: EvidenceItem[] = [];
    
    try {
      const fazSettings = await fortigateRequest(config, '/cmdb/log.fortianalyzer/setting');
      const faz = fazSettings.results || {};
      fortiAnalyzerEnabled = faz.status === 'enable';
      fortiAnalyzerServer = faz.server || 'N/A';
      fortiAnalyzerEvidence = [
        { label: 'FortiAnalyzer Status', value: faz.status || 'disable', type: 'code' as const },
        { label: 'FortiAnalyzer Server', value: fortiAnalyzerServer, type: 'code' as const },
        { label: 'upload-option', value: faz['upload-option'] || 'N/A', type: 'code' as const },
        { label: 'reliable', value: faz.reliable || 'N/A', type: 'code' as const },
      ];
    } catch {
      fortiAnalyzerEvidence = [
        { label: 'FortiAnalyzer', value: 'Não configurado ou sem permissão para verificar', type: 'text' as const },
      ];
    }
    
    // Verificar FortiCloud
    let fortiCloudEnabled = false;
    let fortiCloudEvidence: EvidenceItem[] = [];
    
    try {
      const cloudSettings = await fortigateRequest(config, '/cmdb/log.fortiguard/setting');
      const cloud = cloudSettings.results || {};
      fortiCloudEnabled = cloud.status === 'enable';
      fortiCloudEvidence = [
        { label: 'FortiCloud Status', value: cloud.status || 'disable', type: 'code' as const },
        { label: 'upload-option', value: cloud['upload-option'] || 'N/A', type: 'code' as const },
      ];
    } catch {
      fortiCloudEvidence = [
        { label: 'FortiCloud', value: 'Não configurado ou sem permissão para verificar', type: 'text' as const },
      ];
    }
    
    const logForwardingEnabled = fortiAnalyzerEnabled || fortiCloudEnabled;
    let logForwardingDetails = '';
    let logForwardingRecommendation = '';
    
    if (fortiAnalyzerEnabled && fortiCloudEnabled) {
      logForwardingDetails = `FortiAnalyzer (${fortiAnalyzerServer}) e FortiCloud habilitados`;
      logForwardingRecommendation = 'Manter configuração atual';
    } else if (fortiAnalyzerEnabled) {
      logForwardingDetails = `FortiAnalyzer configurado: ${fortiAnalyzerServer}`;
      logForwardingRecommendation = 'Manter configuração atual';
    } else if (fortiCloudEnabled) {
      logForwardingDetails = 'FortiCloud habilitado';
      logForwardingRecommendation = 'Manter configuração atual';
    } else {
      logForwardingDetails = 'Nenhum sistema de centralização de logs configurado';
      logForwardingRecommendation = 'Configurar envio de logs para FortiAnalyzer ou FortiCloud para centralização e análise';
    }
    
    checks.push({
      id: 'log-002',
      name: 'Envio de Logs para FortiAnalyzer/FortiCloud',
      description: 'Verifica se logs são enviados para FortiAnalyzer ou FortiCloud',
      category: 'Logging e Monitoramento',
      status: logForwardingEnabled ? 'pass' : 'warning',
      severity: 'medium',
      recommendation: logForwardingRecommendation,
      details: logForwardingDetails,
      apiEndpoint: '/api/v2/cmdb/log.fortianalyzer/setting',
      evidence: [
        ...fortiAnalyzerEvidence,
        ...fortiCloudEvidence,
      ],
      rawData: {
        fortiAnalyzerEnabled,
        fortiAnalyzerServer,
        fortiCloudEnabled,
      },
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
      apiEndpoint: '/api/v2/cmdb/log/setting',
    });
  }
  
  return checks;
}

// Função para testar conectividade com o FortiGate
async function testFortiGateConnection(config: FortiGateConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${config.url}/api/v2/monitor/system/status`;
    console.log(`Testing connection to: ${url}`);
    
    const response = await fetchWithoutSSLVerification(url, {
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
      licenseChecks,
    ] = await Promise.all([
      checkInsecureProtocols(config),
      checkFirewallRules(config),
      checkAdminSecurity(config),
      checkUTMProfiles(config),
      checkHAAndBackup(config),
      checkFirmware(config),
      checkVPN(config),
      checkLogging(config),
      checkFortiGuardLicenses(config),
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
      ...licenseChecks,
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
      'Licenciamento',
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
    
    // Calcular score: 100 - pontos de falha
    // Pesos: Critical = 5, High = 3, Medium = 1, Low = 0
    const weights: Record<string, number> = { critical: 5, high: 3, medium: 1, low: 0 };
    let failedPoints = 0;
    
    for (const check of allChecks) {
      if (check.status === 'fail' || check.status === 'warning') {
        const weight = weights[check.severity] || 0;
        failedPoints += weight;
      }
    }
    
    // Score = 100 - pontos de falha (mínimo 0)
    const calculatedScore = Math.max(0, 100 - failedPoints);
    
    // Extrair versão do firmware para CVE lookup
    const firmwareCheck = allChecks.find(c => c.id === 'upd-001');
    const firmwareVersion = firmwareCheck?.rawData?.version as string || '';
    
    const report = {
      overallScore: calculatedScore,
      totalChecks: allChecks.length,
      passed,
      failed,
      warnings,
      categories: categoryData,
      generatedAt: new Date().toISOString(),
      firmwareVersion,
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
    'Licenciamento': 'key',
    'Atualizações': 'download',
  };
  return icons[category] || 'check';
}
