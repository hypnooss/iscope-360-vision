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
  status: 'completed' | 'failed' | 'timeout';
  result?: Record<string, unknown>;
  error_message?: string;
  execution_time_ms?: number;
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
    
    // Gerar evidências automaticamente a partir do valor avaliado
    const evidence: EvidenceItem[] = [];
    if (value !== undefined && value !== null) {
      const isComplex = typeof value === 'object';
      evidence.push({
        label: logic.field_path || rule.name,
        value: isComplex ? JSON.stringify(value, null, 2) : String(value),
        type: isComplex ? 'code' : 'text'
      });
    }
    
    // Incluir dados brutos relevantes (apenas o campo avaliado)
    const checkRawData: Record<string, unknown> = {};
    if (logic.field_path && value !== undefined) {
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
                   : 'failed';

    let complianceResult: ComplianceResult | null = null;
    let firewallName: string | null = null;

    // If task completed successfully and has raw data, process with compliance rules
    if (body.status === 'completed' && body.result && task.target_type === 'firewall') {
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
            body.result as Record<string, unknown>,
            rules as ComplianceRule[]
          );
          
          // Store raw data for debugging/auditing
          complianceResult.raw_data = body.result as Record<string, unknown>;
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
      // Save to analysis_history
      const { data: analysisData } = await supabase
        .from('analysis_history')
        .insert({
          firewall_id: task.target_id,
          score: score,
          report_data: complianceResult,
        })
        .select('id')
        .single();

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
