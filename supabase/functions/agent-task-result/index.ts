import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// Types
// ============================================

interface TaskResultRequest {
  task_id: string;
  status: 'completed' | 'failed' | 'timeout' | 'partial';
  result?: Record<string, unknown>;
  error_message?: string;
  execution_time_ms?: number;
  // Progressive mode fields (when agent sends step results separately)
  steps_completed?: number;
  steps_failed?: number;
}

interface TaskResultSuccessResponse {
  success: true;
  task_id: string;
  status: string;
  score?: number;
  has_more_tasks: boolean;
}

interface TaskResultErrorResponse {
  error: string;
  code: 'TOKEN_EXPIRED' | 'INVALID_SIGNATURE' | 'INVALID_TOKEN' | 'BLOCKED' | 'UNREGISTERED' | 'NOT_FOUND' | 'FORBIDDEN' | 'INTERNAL_ERROR';
}

interface ComplianceRule {
  id: string;
  code: string;
  name: string;
  category: string;
  severity: string;
  description: string | null;
  recommendation: string | null;
  pass_description: string | null;
  fail_description: string | null;
  weight: number;
  evaluation_logic: {
    source_key: string;
    field_path: string;
    conditions: Array<{
      operator: string;
      value?: unknown;
      result: 'pass' | 'fail' | 'warn' | 'unknown';
    }>;
    default_result: 'pass' | 'fail' | 'warn' | 'unknown';
    pass_message?: string;
    fail_message?: string;
  };
}

interface EvidenceItem {
  label: string;
  value: string;
  type: 'text' | 'code';
}

interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  details: string;
  recommendation?: string;
  weight: number;
  // Campos de evidência
  evidence?: EvidenceItem[];
  rawData?: Record<string, unknown>;
  apiEndpoint?: string;
}

interface ComplianceResult {
  score: number;
  checks: ComplianceCheck[];
  categories: Record<string, ComplianceCheck[]>;
  system_info?: Record<string, unknown>;
  raw_data?: Record<string, unknown>;
  firmwareVersion?: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extracts clean version number from a version string
 * Examples: "v7.2.5 build1234" -> "7.2.5", "FortiOS-7.2.5" -> "7.2.5", "SonicOS 7.3.0-7012" -> "7.3.0"
 */
function extractFirmwareVersion(versionString: unknown): string {
  if (!versionString || typeof versionString !== 'string') return '';
  // Match version pattern like 7.2.5 or 7.2 or 7.3.0-7012
  const match = versionString.match(/(\d+\.\d+\.?\d*)/);
  return match ? match[1] : '';
}

/**
 * Parse SonicWall uptime string to human readable format
 * Example: "10 Days, 5 Hours, 58 Minutes, 33 Seconds" -> "10d 5h 58m"
 */
function parseUptimeString(uptimeStr: string): string {
  const days = uptimeStr.match(/(\d+)\s*Days?/i);
  const hours = uptimeStr.match(/(\d+)\s*Hours?/i);
  const minutes = uptimeStr.match(/(\d+)\s*Minutes?/i);
  
  const parts: string[] = [];
  if (days && parseInt(days[1]) > 0) parts.push(`${days[1]}d`);
  if (hours && parseInt(hours[1]) > 0) parts.push(`${hours[1]}h`);
  if (minutes && parseInt(minutes[1]) > 0) parts.push(`${minutes[1]}m`);
  
  return parts.length > 0 ? parts.join(' ') : '0m';
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return current;
}

function evaluateCondition(
  value: unknown,
  condition: { operator: string; value?: unknown; result: string }
): string | null {
  const { operator, value: condValue, result } = condition;
  
  switch (operator) {
    case 'equals':
      if (value === condValue) return result;
      break;
    case 'not_equals':
      if (value !== condValue) return result;
      break;
    case 'contains':
      if (typeof value === 'string' && typeof condValue === 'string' && value.includes(condValue)) return result;
      break;
    case 'not_empty':
      if (value !== null && value !== undefined && value !== '') return result;
      break;
    case 'empty':
      if (value === null || value === undefined || value === '') return result;
      break;
    case 'greater_than':
      if (typeof value === 'number' && typeof condValue === 'number' && value > condValue) return result;
      break;
    case 'less_than':
      if (typeof value === 'number' && typeof condValue === 'number' && value < condValue) return result;
      break;
    case 'greater_than_or_equal':
      if (typeof value === 'number' && typeof condValue === 'number' && value >= condValue) return result;
      break;
    case 'less_than_or_equal':
      if (typeof value === 'number' && typeof condValue === 'number' && value <= condValue) return result;
      break;
    case 'regex':
      if (typeof value === 'string' && typeof condValue === 'string') {
        const regex = new RegExp(condValue);
        if (regex.test(value)) return result;
      }
      break;
  }
  
  return null;
}

// Mapeamento de source_key para endpoint de API (FortiGate, SonicWall, genérico)
const sourceKeyToEndpoint: Record<string, string> = {
  // FortiGate endpoints
  'system_global': '/api/v2/cmdb/system/global',
  'system_interface': '/api/v2/cmdb/system/interface',
  'system_status': '/api/v2/monitor/system/status',
  'system_firmware': '/api/v2/monitor/system/firmware',
  'webui_state': '/api/v2/monitor/system/webui-state',
  'firewall_policy': '/api/v2/cmdb/firewall/policy',
  'firewall_address': '/api/v2/cmdb/firewall/address',
  'vpn_ipsec': '/api/v2/cmdb/vpn.ipsec/phase1-interface',
  'vpn_ssl_settings': '/api/v2/cmdb/vpn.ssl/settings',
  'log_settings': '/api/v2/cmdb/log/setting',
  'log_syslogd': '/api/v2/cmdb/log.syslogd/setting',
  'antivirus_profile': '/api/v2/cmdb/antivirus/profile',
  'webfilter_profile': '/api/v2/cmdb/webfilter/profile',
  'ips_sensor': '/api/v2/cmdb/ips/sensor',
  'dnsfilter_profile': '/api/v2/cmdb/dnsfilter/profile',
  'system_ha': '/api/v2/cmdb/system/ha',
  'system_admin': '/api/v2/cmdb/system/admin',
  'license_status': '/api/v2/monitor/license/status',
  'forticare_status': '/api/v2/monitor/system/forticare',
  // Automation endpoints for backup
  'system_automation_stitch': '/api/v2/cmdb/system/automation-stitch',
  'system_automation_trigger': '/api/v2/cmdb/system/automation-trigger',
  'system_automation_action': '/api/v2/cmdb/system/automation-action',
  // SonicWall endpoints
  'version': '/api/sonicos/version',
  'interfaces': '/api/sonicos/interfaces/ipv4',
  'zones': '/api/sonicos/zones',
  'access_rules': '/api/sonicos/access-rules/ipv4',
  'nat_policies': '/api/sonicos/nat-policies/ipv4',
  'address_objects': '/api/sonicos/address-objects/ipv4',
  'service_objects': '/api/sonicos/service-objects',
  'content_filter': '/api/sonicos/content-filter',
  'gateway_antivirus': '/api/sonicos/gateway-anti-virus',
  'intrusion_prevention': '/api/sonicos/intrusion-prevention',
  'vpn_policies': '/api/sonicos/vpn/policies',
  'ssl_vpn': '/api/sonicos/ssl-vpn',
  'high_availability': '/api/sonicos/high-availability',
  'administration': '/api/sonicos/administration',
  'log_settings_sonic': '/api/sonicos/log/settings',
  // Fallback
  'default': 'API do dispositivo'
};

// ============================================
// Evidence Formatters (ported from fortigate-compliance)
// ============================================

/**
 * Format FortiCare support evidence (lic-001)
 */
function formatFortiCareEvidence(rawData: Record<string, unknown>): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  
  try {
    const licenseData = rawData['license_status'] as Record<string, unknown> | undefined;
    if (!licenseData) {
      return [{ label: 'Status', value: 'Dados não disponíveis', type: 'text' }];
    }
    
    // Extract forticare info from multiple possible paths
    const results = licenseData.results as Record<string, unknown> | undefined;
    const forticareInfo = (results?.forticare as Record<string, unknown>) || 
                          (licenseData.forticare as Record<string, unknown>) || {};
    
    // Check support status
    const support = forticareInfo.support as Record<string, unknown> | undefined;
    const supportStatus = support?.status || forticareInfo.status || 'unknown';
    const isActive = ['licensed', 'registered', 'valid', 'active'].includes(String(supportStatus).toLowerCase());
    
    evidence.push({
      label: 'Status',
      value: isActive ? '✅ Ativo' : '❌ Expirado/Inativo',
      type: 'text'
    });
    
    // Get expiry date
    const expiresRaw = support?.expires || forticareInfo.expires || 
                       support?.expiry_date || forticareInfo.expiry_date || 0;
    
    if (expiresRaw) {
      let expiryDate: Date;
      if (typeof expiresRaw === 'string') {
        expiryDate = new Date(expiresRaw);
      } else {
        expiryDate = new Date(Number(expiresRaw) * 1000);
      }
      
      if (!isNaN(expiryDate.getTime())) {
        const expiryDateStr = expiryDate.toLocaleDateString('pt-BR');
        const daysRemaining = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        evidence.push({
          label: 'Data de Expiração',
          value: expiryDateStr,
          type: 'text'
        });
        
        evidence.push({
          label: 'Dias Restantes',
          value: daysRemaining > 0 ? String(daysRemaining) : 'Expirado',
          type: 'text'
        });
      }
    }
  } catch (e) {
    console.error('Error formatting FortiCare evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
  }
  
  return evidence;
}

/**
 * Format FortiGuard licenses evidence (lic-002)
 */
function formatFortiGuardEvidence(rawData: Record<string, unknown>): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  
  try {
    const licenseData = rawData['license_status'] as Record<string, unknown> | undefined;
    if (!licenseData) {
      return [{ label: 'Status', value: 'Dados não disponíveis', type: 'text' }];
    }
    
    const results = licenseData.results as Record<string, unknown> | undefined;
    const licenses = results || licenseData;
    
    // Service mappings with alternative keys
    const securityServicesMap = [
      { key: 'antivirus', altKeys: ['av', 'fortigate_av', 'fgt_av'], name: 'Antivírus' },
      { key: 'ips', altKeys: ['nids', 'fortigate_ips', 'fgt_ips'], name: 'IPS' },
      { key: 'web_filtering', altKeys: ['webfilter', 'fgd_wf', 'webfiltering', 'fortiguard_webfilter', 'fgt_wf'], name: 'Web Filter' },
      { key: 'appctrl', altKeys: ['app_ctrl', 'application_control', 'fortigate_appctrl'], name: 'App Control' },
      { key: 'antispam', altKeys: ['anti_spam', 'fortigate_antispam', 'fgt_antispam'], name: 'AntiSpam' },
    ];
    
    for (const serviceMapping of securityServicesMap) {
      let serviceInfo = licenses[serviceMapping.key] as Record<string, unknown> | undefined;
      
      // Try alternative keys
      if (!serviceInfo || (typeof serviceInfo === 'object' && Object.keys(serviceInfo).length === 0)) {
        for (const altKey of serviceMapping.altKeys) {
          const altInfo = licenses[altKey] as Record<string, unknown> | undefined;
          if (altInfo && (typeof altInfo !== 'object' || Object.keys(altInfo).length > 0)) {
            serviceInfo = altInfo;
            break;
          }
        }
      }
      
      serviceInfo = serviceInfo || {};
      
      // Get status and expiry
      const status = serviceInfo.status || serviceInfo.entitlement || serviceInfo.license_status || 'unknown';
      const expiry = serviceInfo.expires || serviceInfo.expiry_date || serviceInfo.expire_time || serviceInfo.expiration || 0;
      
      let isActive = false;
      let expiryDateStr = '';
      let daysRemaining = 0;
      
      if (expiry) {
        let expiryDate: Date;
        if (typeof expiry === 'string') {
          expiryDate = new Date(expiry);
        } else {
          expiryDate = new Date(Number(expiry) * 1000);
        }
        
        if (!isNaN(expiryDate.getTime())) {
          expiryDateStr = expiryDate.toLocaleDateString('pt-BR');
          daysRemaining = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          isActive = daysRemaining > 0;
        }
      }
      
      // Check status if date check failed
      if (!isActive && !expiry) {
        const activeStatuses = ['licensed', 'valid', 'active', 'enabled', 'enable', 'registered', '1'];
        isActive = activeStatuses.includes(String(status).toLowerCase());
      }
      
      // Format output
      let valueStr: string;
      if (isActive) {
        if (daysRemaining > 0 && daysRemaining <= 30) {
          valueStr = `⚠️ Expira em ${daysRemaining} dias`;
        } else {
          valueStr = expiryDateStr ? `✅ Ativo até ${expiryDateStr}` : '✅ Ativo';
        }
      } else {
        valueStr = '❌ Expirado/Inativo';
      }
      
      evidence.push({
        label: serviceMapping.name,
        value: valueStr,
        type: 'text'
      });
    }
  } catch (e) {
    console.error('Error formatting FortiGuard evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
  }
  
  return evidence;
}

/**
 * Format VPN evidence (vpn-* rules)
 */
function formatVPNEvidence(rawData: Record<string, unknown>, ruleCode: string): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  
  try {
    // IPsec VPN encryption check
    if (ruleCode === 'vpn-001') {
      const vpnData = rawData['vpn_ipsec'] as Record<string, unknown> | undefined;
      if (!vpnData) {
        return [{ label: 'VPN IPsec', value: 'Dados não disponíveis', type: 'text' }];
      }
      
      const results = (vpnData.results || []) as Array<Record<string, unknown>>;
      const weakAlgorithms = ['des', '3des', 'md5', 'sha1'];
      
      for (const vpn of results.slice(0, 10)) { // Limit to 10 VPNs
        const name = vpn.name as string || 'N/A';
        const proposal = vpn.proposal as string || 'N/A';
        const isWeak = weakAlgorithms.some(alg => proposal.toLowerCase().includes(alg));
        
        evidence.push({
          label: `VPN: ${name}`,
          value: isWeak ? `⚠️ ${proposal}` : `✅ ${proposal}`,
          type: 'code'
        });
      }
      
      if (results.length === 0) {
        evidence.push({ label: 'VPN IPsec', value: 'Nenhuma VPN configurada', type: 'text' });
      }
    }
    // SSL VPN certificate check
    else if (ruleCode === 'vpn-003') {
      const sslData = rawData['vpn_ssl_settings'] as Record<string, unknown> | undefined;
      if (!sslData) {
        return [{ label: 'SSL VPN', value: 'Não configurado', type: 'text' }];
      }
      
      const results = sslData.results as Record<string, unknown> || sslData;
      const servercert = results.servercert as string || 'Fortinet_Factory';
      const loginPort = results['login-port'] as number || 443;
      
      evidence.push({ label: 'Certificado', value: servercert, type: 'code' });
      evidence.push({ label: 'Porta', value: String(loginPort), type: 'text' });
    }
    // Generic VPN rule
    else {
      const vpnData = rawData['vpn_ipsec'] as Record<string, unknown> | undefined;
      const sslData = rawData['vpn_ssl_settings'] as Record<string, unknown> | undefined;
      
      if (vpnData?.results) {
        const results = vpnData.results as Array<Record<string, unknown>>;
        evidence.push({ label: 'VPNs IPsec', value: String(results.length), type: 'text' });
      }
      if (sslData?.results) {
        const status = (sslData.results as Record<string, unknown>).status || 'disable';
        evidence.push({ label: 'SSL VPN', value: status === 'enable' ? '✅ Ativo' : '❌ Inativo', type: 'text' });
      }
    }
  } catch (e) {
    console.error('Error formatting VPN evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
  }
  
  return evidence.length > 0 ? evidence : [{ label: 'VPN', value: 'Sem dados', type: 'text' }];
}

/**
 * Format Logging evidence (log-* rules)
 */
function formatLoggingEvidence(rawData: Record<string, unknown>, ruleCode: string): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  
  try {
    if (ruleCode === 'log-001') {
      // General log settings
      const logData = rawData['log_settings'] as Record<string, unknown> | undefined;
      if (!logData) {
        return [{ label: 'Logging', value: 'Dados não disponíveis', type: 'text' }];
      }
      
      const results = logData.results as Record<string, unknown> || logData;
      const logInvalidPacket = results['log-invalid-packet'] as string || 'disable';
      const resolveIp = results['resolve-ip'] as string || 'disable';
      
      evidence.push({ label: 'log-invalid-packet', value: logInvalidPacket, type: 'code' });
      evidence.push({ label: 'resolve-ip', value: resolveIp, type: 'code' });
    }
    else if (ruleCode === 'log-002') {
      // Log forwarding (FortiAnalyzer/FortiCloud)
      let fortiAnalyzerEnabled = false;
      let fortiAnalyzerServer = 'N/A';
      let fortiCloudEnabled = false;
      
      // Check FortiAnalyzer
      const fazData = rawData['log_fortianalyzer'] as Record<string, unknown> | undefined;
      if (fazData) {
        const results = fazData.results as Record<string, unknown> || fazData;
        fortiAnalyzerEnabled = results.status === 'enable';
        fortiAnalyzerServer = results.server as string || 'N/A';
      }
      
      // Check FortiCloud
      const cloudData = rawData['log_fortiguard'] as Record<string, unknown> | undefined;
      if (cloudData) {
        const results = cloudData.results as Record<string, unknown> || cloudData;
        fortiCloudEnabled = results.status === 'enable';
      }
      
      evidence.push({
        label: 'FortiAnalyzer',
        value: fortiAnalyzerEnabled ? `✅ ${fortiAnalyzerServer}` : '❌ Não configurado',
        type: 'text'
      });
      evidence.push({
        label: 'FortiCloud',
        value: fortiCloudEnabled ? '✅ Habilitado' : '❌ Não configurado',
        type: 'text'
      });
    }
    else {
      // Generic log rule
      const logData = rawData['log_settings'] as Record<string, unknown> | undefined;
      if (logData?.results) {
        const results = logData.results as Record<string, unknown>;
        for (const [key, val] of Object.entries(results).slice(0, 5)) {
          evidence.push({ label: key, value: String(val), type: 'text' });
        }
      }
    }
  } catch (e) {
    console.error('Error formatting Logging evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
  }
  
  return evidence.length > 0 ? evidence : [{ label: 'Logging', value: 'Sem dados', type: 'text' }];
}

/**
 * Format HA (High Availability) evidence (ha-001)
 */
function formatHAEvidence(rawData: Record<string, unknown>): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  
  try {
    const haData = rawData['system_ha'] as Record<string, unknown> | undefined;
    if (!haData) {
      return [{ label: 'HA', value: 'Dados não disponíveis', type: 'text' }];
    }
    
    const results = haData.results as Record<string, unknown> || haData;
    const mode = results.mode as string || 'standalone';
    const groupName = results['group-name'] as string || 'N/A';
    const priority = results.priority || 'N/A';
    
    evidence.push({ label: 'Modo', value: mode, type: 'text' });
    if (mode !== 'standalone') {
      evidence.push({ label: 'Grupo', value: String(groupName), type: 'text' });
      evidence.push({ label: 'Prioridade', value: String(priority), type: 'text' });
    }
  } catch (e) {
    console.error('Error formatting HA evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
  }
  
  return evidence;
}

/**
 * Format Backup evidence (bkp-001)
 * Uses automation stitch/trigger/action data to detect backup configuration
 */
function formatBackupEvidence(rawData: Record<string, unknown>): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  
  try {
    // Verificar automações de backup
    const stitchData = rawData['system_automation_stitch'] as Record<string, unknown> | undefined;
    const triggerData = rawData['system_automation_trigger'] as Record<string, unknown> | undefined;
    const actionData = rawData['system_automation_action'] as Record<string, unknown> | undefined;
    
    // Verificar se há ações de backup configuradas
    const actions = (actionData?.results || []) as Array<Record<string, unknown>>;
    const backupActions = actions.filter(a => 
      a['action-type'] === 'backup' || 
      a['action-type'] === 'config-backup' ||
      String(a.name || '').toLowerCase().includes('backup')
    );
    
    // Verificar triggers agendados
    const triggers = (triggerData?.results || []) as Array<Record<string, unknown>>;
    const scheduledTriggers = triggers.filter(t => 
      t['trigger-type'] === 'scheduled' || 
      t['trigger-type'] === 'event-based'
    );
    
    // Verificar stitches que combinam trigger + action de backup
    const stitches = (stitchData?.results || []) as Array<Record<string, unknown>>;
    
    if (backupActions.length > 0 && scheduledTriggers.length > 0) {
      evidence.push({
        label: 'Status',
        value: '✅ Backup automático configurado',
        type: 'text'
      });
      
      // Listar ações de backup encontradas
      for (const action of backupActions.slice(0, 3)) {
        evidence.push({
          label: 'Ação',
          value: String(action.name || 'backup'),
          type: 'code'
        });
      }
      
      // Listar triggers agendados
      for (const trigger of scheduledTriggers.slice(0, 3)) {
        evidence.push({
          label: 'Agendamento',
          value: String(trigger.name || trigger['trigger-type']),
          type: 'text'
        });
      }
    } else if (backupActions.length > 0) {
      evidence.push({
        label: 'Status',
        value: '⚠️ Ação de backup existe, mas sem agendamento',
        type: 'text'
      });
    } else {
      evidence.push({
        label: 'Status',
        value: '❌ Nenhum backup automático configurado',
        type: 'text'
      });
    }
    
    // Mostrar totais encontrados
    evidence.push({
      label: 'Automações',
      value: `${stitches.length} stitches, ${triggers.length} triggers, ${actions.length} ações`,
      type: 'text'
    });
    
  } catch (e) {
    console.error('Error formatting Backup evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
  }
  
  return evidence;
}

/**
 * Helper to check if an interface has WAN or SD-WAN role
 */
function isWanInterface(interfaceName: string, interfaces: Array<Record<string, unknown>>): boolean {
  if (!interfaceName || !interfaces) return false;
  
  const iface = interfaces.find(i => i.name === interfaceName);
  if (!iface) return false;
  
  const role = String(iface.role || '').toLowerCase();
  return role === 'wan' || role === 'sd-wan' || role.includes('wan');
}

/**
 * Helper to check if source includes "all" object
 */
function hasAllSource(srcaddr: Array<Record<string, unknown>> | undefined): boolean {
  if (!Array.isArray(srcaddr)) return false;
  return srcaddr.some(addr => 
    String(addr.name || addr.q_origin_key || '').toLowerCase() === 'all'
  );
}

/**
 * Helper to check if service matches specific protocols
 */
function serviceMatchesProtocol(
  service: Array<Record<string, unknown>> | undefined,
  protocols: string[]
): boolean {
  if (!Array.isArray(service)) return false;
  
  const protocolsLower = protocols.map(p => p.toLowerCase());
  
  return service.some(svc => {
    const name = String(svc.name || svc.q_origin_key || '').toLowerCase();
    return protocolsLower.some(proto => 
      name.includes(proto) || name === proto
    );
  });
}

/**
 * Format Inbound Rules evidence - filters policies by WAN interfaces and specific conditions
 */
function formatInboundRuleEvidence(
  rawData: Record<string, unknown>,
  ruleCode: string
): { evidence: EvidenceItem[], relevantPolicies: Array<Record<string, unknown>> } {
  const evidence: EvidenceItem[] = [];
  const relevantPolicies: Array<Record<string, unknown>> = [];
  
  try {
    // Get firewall policies and interfaces
    const policyData = rawData['firewall_policy'] as Record<string, unknown> | undefined;
    const interfaceData = rawData['system_interface'] as Record<string, unknown> | undefined;
    
    const policies = (policyData?.results || []) as Array<Record<string, unknown>>;
    const interfaces = (interfaceData?.results || []) as Array<Record<string, unknown>>;
    
    if (!policies.length) {
      evidence.push({ label: 'Status', value: 'Nenhuma política encontrada', type: 'text' });
      return { evidence, relevantPolicies };
    }
    
    if (!interfaces.length) {
      evidence.push({ label: 'Aviso', value: 'Dados de interfaces não disponíveis', type: 'text' });
    }
    
    // Get WAN/SD-WAN interface names for reference
    const wanInterfaces = interfaces
      .filter(i => {
        const role = String(i.role || '').toLowerCase();
        return role === 'wan' || role === 'sd-wan' || role.includes('wan');
      })
      .map(i => String(i.name));
    
    // Filter policies based on rule type
    for (const policy of policies) {
      // Check if source interface is WAN
      const srcintf = policy.srcintf as Array<Record<string, unknown>> | undefined;
      const srcintfNames = (srcintf || []).map(i => String(i.name || i.q_origin_key || ''));
      
      const isFromWan = srcintfNames.some(name => 
        wanInterfaces.includes(name) || 
        name.toLowerCase().includes('wan') ||
        name.toLowerCase().includes('sd-wan') ||
        isWanInterface(name, interfaces)
      );
      
      if (!isFromWan) continue; // Skip non-WAN policies
      
      const srcaddr = policy.srcaddr as Array<Record<string, unknown>> | undefined;
      const service = policy.service as Array<Record<string, unknown>> | undefined;
      
      let matchesRule = false;
      
      if (ruleCode === 'inb-001') {
        // Regras de Entrada sem Restrição de Origem
        // Policies with "all" as source
        matchesRule = hasAllSource(srcaddr);
      } else if (ruleCode === 'inb-002') {
        // RDP Exposto para Internet
        // Policies with RDP service (3389)
        matchesRule = serviceMatchesProtocol(service, ['rdp', '3389', 'RDP']);
      } else if (ruleCode === 'inb-003') {
        // SMB/CIFS Exposto para Internet
        // Policies with SMB/CIFS service (445, 139)
        matchesRule = serviceMatchesProtocol(service, ['smb', 'cifs', '445', '139', 'SMB', 'CIFS', 'SAMBA', 'netbios']);
      }
      
      if (matchesRule) {
        relevantPolicies.push(policy);
      }
    }
    
    // Generate evidence
    if (relevantPolicies.length === 0) {
      evidence.push({
        label: 'Status',
        value: '✅ Nenhuma regra vulnerável encontrada',
        type: 'text'
      });
    } else {
      evidence.push({
        label: 'Status',
        value: `❌ ${relevantPolicies.length} regra(s) vulnerável(is) encontrada(s)`,
        type: 'text'
      });
      
      // Show details of problematic policies (max 5)
      for (const policy of relevantPolicies.slice(0, 5)) {
        const policyId = policy.policyid || policy.id || 'N/A';
        const policyName = policy.name || `Policy ${policyId}`;
        const srcintf = (policy.srcintf as Array<Record<string, unknown>> || [])
          .map(i => i.name || i.q_origin_key).join(', ');
        const dstintf = (policy.dstintf as Array<Record<string, unknown>> || [])
          .map(i => i.name || i.q_origin_key).join(', ');
        const srcaddr = (policy.srcaddr as Array<Record<string, unknown>> || [])
          .map(a => a.name || a.q_origin_key).join(', ');
        const dstaddr = (policy.dstaddr as Array<Record<string, unknown>> || [])
          .map(a => a.name || a.q_origin_key).join(', ');
        const service = (policy.service as Array<Record<string, unknown>> || [])
          .map(s => s.name || s.q_origin_key).join(', ');
        const action = policy.action || 'N/A';
        const status = policy.status === 'enable' ? '🟢' : '🔴';
        
        evidence.push({
          label: `Regra ${policyId}`,
          value: `${status} ${policyName}`,
          type: 'text'
        });
        
        evidence.push({
          label: `  Origem`,
          value: `${srcintf} → ${srcaddr}`,
          type: 'code'
        });
        
        evidence.push({
          label: `  Destino`,
          value: `${dstintf} → ${dstaddr}`,
          type: 'code'
        });
        
        evidence.push({
          label: `  Serviço`,
          value: service || 'ALL',
          type: 'code'
        });
        
        evidence.push({
          label: `  Ação`,
          value: String(action).toUpperCase(),
          type: 'text'
        });
      }
      
      if (relevantPolicies.length > 5) {
        evidence.push({
          label: 'Aviso',
          value: `... e mais ${relevantPolicies.length - 5} regra(s)`,
          type: 'text'
        });
      }
    }
    
    // Show WAN interfaces for context
    if (wanInterfaces.length > 0) {
      evidence.push({
        label: 'Interfaces WAN',
        value: wanInterfaces.join(', '),
        type: 'code'
      });
    }
    
  } catch (e) {
    console.error('Error formatting Inbound rule evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
  }
  
  return { evidence, relevantPolicies };
}

/**
 * Format generic evidence with truncation for large objects
 */
function formatGenericEvidence(value: unknown, fieldPath: string): EvidenceItem[] {
  if (value === undefined || value === null) {
    return [];
  }
  
  const isComplex = typeof value === 'object';
  let displayValue: string;
  
  if (isComplex) {
    const jsonStr = JSON.stringify(value, null, 2);
    // Truncate if too large
    if (jsonStr.length > 500) {
      displayValue = jsonStr.substring(0, 500) + '\n... (truncado)';
    } else {
      displayValue = jsonStr;
    }
  } else {
    displayValue = String(value);
  }
  
  return [{
    label: fieldPath,
    value: displayValue,
    type: isComplex ? 'code' : 'text'
  }];
};

function processComplianceRules(
  rawData: Record<string, unknown>,
  rules: ComplianceRule[]
): ComplianceResult {
  const checks: ComplianceCheck[] = [];
  
  for (const rule of rules) {
    const logic = rule.evaluation_logic;
    
    // Mapear endpoint da API
    const apiEndpoint = sourceKeyToEndpoint[logic.source_key] || sourceKeyToEndpoint['default'];
    
    // Get the source data
    const sourceData = rawData[logic.source_key];
    if (!sourceData) {
      checks.push({
        id: rule.code,
        name: rule.name,
        description: rule.description || rule.name,
        category: rule.category,
        severity: rule.severity,
        status: 'unknown',
        details: `Dados não disponíveis: ${logic.source_key}`,
        recommendation: rule.recommendation || undefined,
        weight: rule.weight,
        apiEndpoint,
      });
      continue;
    }
    
    // Get the value at the field path
    const value = getNestedValue(sourceData as Record<string, unknown>, logic.field_path);
    
    // Evaluate conditions
    let status: 'pass' | 'fail' | 'warn' | 'unknown' = logic.default_result as 'pass' | 'fail' | 'warn' | 'unknown';
    
    for (const condition of logic.conditions) {
      const condResult = evaluateCondition(value, condition);
      if (condResult) {
        status = condResult as 'pass' | 'fail' | 'warn' | 'unknown';
        break;
      }
    }
    
    // Generate details message - use database fields first, then logic, then default
    let details = '';
    if (status === 'pass') {
      details = rule.pass_description || logic.pass_message || `Verificação aprovada`;
    } else if (status === 'fail' || status === 'warn') {
      details = rule.fail_description || logic.fail_message || `Valor atual: ${JSON.stringify(value)}`;
    } else {
      details = `Valor: ${JSON.stringify(value)}`;
    }
    
    // Use rule description or generate one
    const description = rule.description || rule.name;
    
    // Gerar evidências usando formatadores especializados baseados no código da regra
    let evidence: EvidenceItem[] = [];
    let inboundResult: { evidence: EvidenceItem[], relevantPolicies: Array<Record<string, unknown>> } | null = null;
    
    // Detectar regra e aplicar formatador apropriado
    if (rule.code === 'lic-001') {
      // FortiCare Support
      evidence = formatFortiCareEvidence(rawData);
    } else if (rule.code === 'lic-002') {
      // FortiGuard Licenses
      evidence = formatFortiGuardEvidence(rawData);
    } else if (rule.code.startsWith('inb-')) {
      // Inbound Rules (inb-001, inb-002, inb-003)
      inboundResult = formatInboundRuleEvidence(rawData, rule.code);
      evidence = inboundResult.evidence;
      // Override status based on actual policy analysis
      if (inboundResult.relevantPolicies.length > 0) {
        status = 'fail';
        details = rule.fail_description || `${inboundResult.relevantPolicies.length} regra(s) vulnerável(is) encontrada(s)`;
      } else {
        status = 'pass';
        details = rule.pass_description || 'Nenhuma regra vulnerável encontrada';
      }
    } else if (rule.code.startsWith('vpn-')) {
      // VPN rules
      evidence = formatVPNEvidence(rawData, rule.code);
    } else if (rule.code.startsWith('log-')) {
      // Logging rules
      evidence = formatLoggingEvidence(rawData, rule.code);
    } else if (rule.code === 'ha-001') {
      // High Availability
      evidence = formatHAEvidence(rawData);
    } else if (rule.code === 'bkp-001') {
      // Backup
      evidence = formatBackupEvidence(rawData);
    } else if (value !== undefined && value !== null) {
      // Fallback genérico com truncamento
      evidence = formatGenericEvidence(value, logic.field_path || rule.name);
    }
    
    // Incluir dados brutos relevantes
    let checkRawData: Record<string, unknown> = {};
    
    // Para regras de licenciamento, incluir dados completos do license_status
    if (rule.code === 'lic-001' || rule.code === 'lic-002') {
      const licenseData = rawData['license_status'];
      if (licenseData) {
        checkRawData = { license_status: licenseData };
      }
    } else if (rule.code === 'bkp-001') {
      // Incluir dados de automação para backup
      checkRawData = {
        system_automation_stitch: rawData['system_automation_stitch'],
        system_automation_trigger: rawData['system_automation_trigger'],
        system_automation_action: rawData['system_automation_action']
      };
    } else if (rule.code.startsWith('inb-') && inboundResult) {
      // Para regras de inbound, incluir apenas as policies relevantes
      if (inboundResult.relevantPolicies.length > 0) {
        checkRawData = {
          policies_vulneraveis: inboundResult.relevantPolicies.map(p => ({
            policyid: p.policyid,
            name: p.name,
            srcintf: p.srcintf,
            dstintf: p.dstintf,
            srcaddr: p.srcaddr,
            dstaddr: p.dstaddr,
            service: p.service,
            action: p.action,
            status: p.status
          }))
        };
      }
    } else if (logic.field_path && value !== undefined) {
      checkRawData[logic.field_path] = value;
    }
    
    checks.push({
      id: rule.code,
      name: rule.name,
      description,
      category: rule.category,
      severity: rule.severity,
      status,
      details,
      recommendation: status !== 'pass' ? (rule.recommendation || undefined) : undefined,
      weight: rule.weight,
      evidence: evidence.length > 0 ? evidence : undefined,
      rawData: Object.keys(checkRawData).length > 0 ? checkRawData : undefined,
      apiEndpoint,
    });
  }
  
  // Calculate score
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const passedWeight = checks
    .filter(check => check.status === 'pass')
    .reduce((sum, check) => sum + check.weight, 0);
  const warnWeight = checks
    .filter(check => check.status === 'warn')
    .reduce((sum, check) => sum + (check.weight * 0.5), 0);
  
  const score = totalWeight > 0 
    ? Math.round(((passedWeight + warnWeight) / totalWeight) * 100)
    : 0;
  
  // Group by category
  const categories: Record<string, ComplianceCheck[]> = {};
  for (const check of checks) {
    if (!categories[check.category]) {
      categories[check.category] = [];
    }
    categories[check.category].push(check);
  }
  
  // Extract system info if available
  const systemInfo: Record<string, unknown> = {};
  const systemStatus = rawData['system_status'] as Record<string, unknown> | undefined;
  const systemFirmware = rawData['system_firmware'] as Record<string, unknown> | undefined;
  
  // ===== SonicWall specific parsing =====
  const versionData = rawData['version'] as Record<string, unknown> | undefined;
  if (versionData) {
    // SonicWall returns version info directly at root level
    if (versionData.serial_number) systemInfo.serial = versionData.serial_number;
    if (versionData.model) systemInfo.model = versionData.model;
    if (versionData.firmware_version) systemInfo.firmware = versionData.firmware_version;
    if (versionData.system_uptime && typeof versionData.system_uptime === 'string') {
      systemInfo.uptime = parseUptimeString(versionData.system_uptime);
    }
    console.log('SonicWall version data found:', JSON.stringify(versionData));
  }
  
  // ===== FortiGate specific parsing =====
  // Try to get system info from multiple sources
  // FortiGate API returns: { serial, version at root level, results: { hostname, model, uptime } }
  if (systemStatus) {
    // Fields at root level of system_status
    if (!systemInfo.serial) systemInfo.serial = systemStatus.serial;
    if (!systemInfo.firmware) systemInfo.version = systemStatus.version;
    
    // Fields inside results
    if (systemStatus.results) {
      const results = systemStatus.results as Record<string, unknown>;
      if (!systemInfo.hostname) systemInfo.hostname = results.hostname;
      if (!systemInfo.model) systemInfo.model = results.model || results.model_name;
    }
  }
  
  // Try to get uptime from webui_state endpoint (more reliable source for FortiGate)
  const webuiState = rawData['webui_state'] as Record<string, unknown> | undefined;
  if (webuiState?.results) {
    const results = webuiState.results as Record<string, unknown>;
    
    // Calculate uptime from utc_last_reboot and snapshot_utc_time (both in milliseconds)
    const lastReboot = results.utc_last_reboot as number | undefined;
    const snapshotTime = results.snapshot_utc_time as number | undefined;
    
    if (typeof lastReboot === 'number' && typeof snapshotTime === 'number' && !systemInfo.uptime) {
      const uptimeSec = Math.floor((snapshotTime - lastReboot) / 1000);
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      systemInfo.uptime = days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
      console.log(`Calculated uptime: ${systemInfo.uptime} from reboot=${lastReboot}, snapshot=${snapshotTime}`);
    }
    
    // Also get serial/hostname from here if not already set
    if (!systemInfo.serial && results.serial) {
      systemInfo.serial = results.serial;
    }
    if (!systemInfo.hostname && results.hostname) {
      systemInfo.hostname = results.hostname;
    }
  }
  
  // Extract firmware version from multiple possible sources
  let firmwareVersion = '';
  
  // Source 1: system_status.results.version
  if (systemStatus?.results) {
    const results = systemStatus.results as Record<string, unknown>;
    firmwareVersion = extractFirmwareVersion(results.version);
  }
  
  // Source 2: system_firmware - multiple paths
  if (!firmwareVersion && systemFirmware) {
    const fwObj = systemFirmware as Record<string, unknown>;
    
    // Direct version field (most common in FortiOS API responses)
    if (fwObj.version) {
      firmwareVersion = extractFirmwareVersion(fwObj.version);
    }
    
    // Nested: results.current.version or current.version
    if (!firmwareVersion) {
      const resultsObj = fwObj.results as Record<string, unknown> | undefined;
      const current = (fwObj.current || resultsObj?.current) as Record<string, unknown> | undefined;
      if (current?.version) {
        firmwareVersion = extractFirmwareVersion(current.version);
      }
    }
    
    // Nested: results.version
    if (!firmwareVersion && fwObj.results) {
      const resultsObj = fwObj.results as Record<string, unknown>;
      if (resultsObj.version) {
        firmwareVersion = extractFirmwareVersion(resultsObj.version);
      }
    }
  }
  
  // Source 3: Check raw_data for any version-like field
  if (!firmwareVersion) {
    for (const [key, value] of Object.entries(rawData)) {
      if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        // Check results.version pattern
        if (obj.results && typeof obj.results === 'object') {
          const results = obj.results as Record<string, unknown>;
          if (results.version) {
            firmwareVersion = extractFirmwareVersion(results.version);
            if (firmwareVersion) break;
          }
        }
        // Check direct version field
        if (obj.version) {
          firmwareVersion = extractFirmwareVersion(obj.version);
          if (firmwareVersion) break;
        }
      }
    }
  }
  
  console.log(`Extracted firmware version: "${firmwareVersion}" from raw data`);
  
  return {
    score,
    checks,
    categories,
    system_info: Object.keys(systemInfo).length > 0 ? systemInfo : undefined,
    firmwareVersion: firmwareVersion || undefined,
  };
}

// ============================================
// Main Handler
// ============================================

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Extract Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Token de autorização ausente ou inválido', code: 'INVALID_TOKEN' } as TaskResultErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Decode token to get the agent_id (sub claim)
    let tokenPayload: { sub?: string; exp?: number };
    try {
      const [, payloadBase64] = decode(token);
      tokenPayload = payloadBase64 as { sub?: string; exp?: number };
    } catch (decodeError) {
      console.error('Failed to decode token:', decodeError);
      return new Response(
        JSON.stringify({ error: 'Token inválido', code: 'INVALID_TOKEN' } as TaskResultErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agentId = tokenPayload.sub;
    if (!agentId) {
      console.log('Token does not contain agent ID (sub claim)');
      return new Response(
        JSON.stringify({ error: 'Token não contém identificação do agent', code: 'INVALID_TOKEN' } as TaskResultErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch agent data
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('id, jwt_secret, revoked')
      .eq('id', agentId)
      .single();

    if (fetchError || !agent) {
      console.log('Agent not found:', agentId);
      return new Response(
        JSON.stringify({ error: 'Agent não encontrado', code: 'INVALID_TOKEN' } as TaskResultErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if agent is revoked
    if (agent.revoked) {
      console.log('Agent is blocked:', agentId);
      return new Response(
        JSON.stringify({ error: 'Agent bloqueado', code: 'BLOCKED' } as TaskResultErrorResponse),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if agent has jwt_secret (is registered)
    if (!agent.jwt_secret) {
      console.log('Agent is not registered (no jwt_secret):', agentId);
      return new Response(
        JSON.stringify({ error: 'Agent desregistrado', code: 'UNREGISTERED' } as TaskResultErrorResponse),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check token expiration
    if (tokenPayload.exp && tokenPayload.exp < Math.floor(Date.now() / 1000)) {
      console.log('Token has expired:', agentId);
      return new Response(
        JSON.stringify({ error: 'Token expirado', code: 'TOKEN_EXPIRED' } as TaskResultErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the token signature
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(agent.jwt_secret);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      await verify(token, cryptoKey);
    } catch (verifyError) {
      console.error('Token signature verification failed:', verifyError);
      return new Response(
        JSON.stringify({ error: 'Assinatura do token inválida', code: 'INVALID_SIGNATURE' } as TaskResultErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let body: TaskResultRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Corpo da requisição inválido', code: 'INTERNAL_ERROR' } as TaskResultErrorResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!body.task_id || !body.status) {
      return new Response(
        JSON.stringify({ error: 'task_id e status são obrigatórios', code: 'INTERNAL_ERROR' } as TaskResultErrorResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the task to verify ownership
    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .select('id, agent_id, task_type, target_id, target_type, status')
      .eq('id', body.task_id)
      .single();

    if (taskError || !task) {
      console.log('Task not found:', body.task_id);
      return new Response(
        JSON.stringify({ error: 'Tarefa não encontrada', code: 'NOT_FOUND' } as TaskResultErrorResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify agent owns this task
    if (task.agent_id !== agentId) {
      console.log('Agent does not own this task:', { agentId, taskAgentId: task.agent_id });
      return new Response(
        JSON.stringify({ error: 'Tarefa não pertence a este agent', code: 'FORBIDDEN' } as TaskResultErrorResponse),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map status to database enum
    const dbStatus = body.status === 'completed' ? 'completed' 
                   : body.status === 'failed' ? 'failed' 
                   : body.status === 'timeout' ? 'timeout'
                   : body.status === 'partial' ? 'failed'
                   : 'failed';

    let complianceResult: ComplianceResult | null = null;
    let firewallName: string | null = null;

    // Determine raw data source:
    // 1. If body.result is provided (legacy batch mode), use it directly
    // 2. If no body.result (progressive mode), reconstruct from task_step_results
    let rawData: Record<string, unknown> | null = null;

    if (body.result) {
      // Legacy batch mode - agent sent all data in one payload
      rawData = body.result as Record<string, unknown>;
      console.log(`Using legacy batch mode data for task ${body.task_id}`);
    } else if (body.status === 'completed' || body.status === 'partial') {
      // Progressive mode - reconstruct raw_data from task_step_results
      console.log(`Reconstructing data from step results for task ${body.task_id}`);
      
      const { data: stepResults, error: stepError } = await supabase
        .from('task_step_results')
        .select('step_id, data, status')
        .eq('task_id', body.task_id);

      if (stepError) {
        console.error('Failed to fetch step results:', stepError);
      } else if (stepResults && stepResults.length > 0) {
        rawData = {};
        for (const step of stepResults) {
          if (step.status === 'success' && step.data) {
            rawData[step.step_id] = step.data;
          }
        }
        console.log(`Reconstructed raw_data from ${stepResults.length} steps, ${Object.keys(rawData).length} successful`);
      }
    }

    // If task completed successfully and has raw data, process with compliance rules
    if ((body.status === 'completed' || body.status === 'partial') && rawData && task.target_type === 'firewall') {
      // Get device_type_id and name from firewall
      const { data: firewall } = await supabase
        .from('firewalls')
        .select('device_type_id, name')
        .eq('id', task.target_id)
        .single();

      // Store firewall name for later use in alerts
      firewallName = firewall?.name || null;
      let deviceTypeId = firewall?.device_type_id;

      // If no device_type_id, use default FortiGate
      if (!deviceTypeId) {
        const { data: defaultType } = await supabase
          .from('device_types')
          .select('id')
          .eq('code', 'fortigate')
          .eq('is_active', true)
          .single();
        
        deviceTypeId = defaultType?.id;
      }

      if (deviceTypeId) {
        // Fetch compliance rules for this device type
        const { data: rules } = await supabase
          .from('compliance_rules')
          .select('id, code, name, category, severity, description, recommendation, pass_description, fail_description, weight, evaluation_logic')
          .eq('device_type_id', deviceTypeId)
          .eq('is_active', true)
          .order('category')
          .order('name');

        if (rules && rules.length > 0) {
          console.log(`Processing ${rules.length} compliance rules for device type ${deviceTypeId}`);
          complianceResult = processComplianceRules(
            rawData,
            rules as ComplianceRule[]
          );
          
          // Store raw data for debugging/auditing (only for legacy mode)
          // In progressive mode, raw data is already in task_step_results
          if (body.result) {
            complianceResult.raw_data = rawData;
          }
        }
      }
    }

    // Prepare result to save
    const resultToSave = complianceResult || body.result;
    const score = complianceResult?.score ?? null;

    // Update task with result
    const { error: updateError } = await supabase
      .from('agent_tasks')
      .update({
        status: dbStatus,
        result: resultToSave || null,
        error_message: body.error_message || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', body.task_id);

    if (updateError) {
      console.error('Failed to update task:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar tarefa', code: 'INTERNAL_ERROR' } as TaskResultErrorResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we have a compliance result, save to analysis_history
    if (complianceResult && score !== null) {
      // Create a lightweight version of the compliance result for history
      // Exclude raw_data to avoid timeout on large datasets (raw_data is already in agent_tasks.result)
      const historyReportData = {
        score: complianceResult.score,
        checks: complianceResult.checks,
        categories: complianceResult.categories,
        system_info: complianceResult.system_info,
        firmwareVersion: complianceResult.firmwareVersion,
        // raw_data is intentionally excluded - it's stored in agent_tasks.result
      };
      
      // Save to analysis_history
      const { data: analysisData, error: historyError } = await supabase
        .from('analysis_history')
        .insert({
          firewall_id: task.target_id,
          score: score,
          report_data: historyReportData,
        })
        .select('id')
        .single();
      
      if (historyError) {
        console.error('Failed to save analysis history:', historyError);
      }

      // Update firewall last_analysis_at and last_score
      await supabase
        .from('firewalls')
        .update({
          last_analysis_at: new Date().toISOString(),
          last_score: score,
        })
        .eq('id', task.target_id);

      // Use firewall name from earlier query (already fetched at line 644)
      const alertFirewallName = firewallName || 'Dispositivo';
      
      console.log(`Creating analysis alert for firewall: ${alertFirewallName} (id: ${task.target_id})`);

      // Create system alert for analysis completion
      // Always use 'success' severity for completed analyses (green/teal color)
      const alertSeverity = 'success';
      await supabase
        .from('system_alerts')
        .insert({
          alert_type: 'firewall_analysis_completed',
          title: 'Análise Concluída',
          message: `A análise do firewall "${alertFirewallName}" foi concluída com score ${score}%.`,
          severity: alertSeverity,
          target_role: null,
          is_active: true,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          metadata: {
            firewall_id: task.target_id,
            score: score,
            analysis_id: analysisData?.id || null
          }
        });

      console.log(`Compliance result saved: score=${score}, checks=${complianceResult.checks.length}, alert created`);
    }

    console.log(`Task ${body.task_id} updated to ${dbStatus} by agent ${agentId}`);

    // Check if there are more pending tasks
    const { count } = await supabase
      .from('agent_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    const response: TaskResultSuccessResponse = {
      success: true,
      task_id: body.task_id,
      status: dbStatus,
      score: score ?? undefined,
      has_more_tasks: (count || 0) > 0,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in agent-task-result:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' } as TaskResultErrorResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
