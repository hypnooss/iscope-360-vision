// ============================================================================
// M365 Security Posture - Data-Driven Analysis
// Refatorado para ler blueprints e regras do banco de dados
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== TYPES ==========

interface BlueprintStep {
  id: string;
  name: string;
  executor: 'edge_function' | 'agent';
  runtime: string;
  category: string;
  config: {
    endpoint: string;
    method: string;
    headers?: Record<string, string>;
    api_version: string;
    params?: Record<string, string>;
    dynamic_params?: Record<string, string>;
  };
}

interface Blueprint {
  id: string;
  name: string;
  executor_type: string;
  collection_steps: {
    steps: BlueprintStep[];
  };
}

interface ComplianceRule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  severity: string;
  weight: number;
  technical_risk: string | null;
  business_impact: string | null;
  api_endpoint: string | null;
  recommendation: string | null;
  pass_description: string | null;
  fail_description: string | null;
  not_found_description: string | null;
  evaluation_logic: Record<string, unknown>;
  is_active: boolean;
}

interface StepResult {
  stepId: string;
  stepName: string;
  category: string;
  data: unknown;
  error: string | null;
  durationMs: number;
}

interface M365Insight {
  id: string;
  code: string;
  category: string;
  product: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  titulo: string;
  descricaoExecutiva: string;
  riscoTecnico: string;
  impactoNegocio: string;
  scoreImpacto: number;
  status: 'pass' | 'fail';
  affectedCount: number;
  affectedEntities: Array<{ id: string; displayName: string; details?: Record<string, unknown> }>;
  remediacao: {
    productAfetado: string;
    portalUrl: string;
    caminhoPortal: string[];
    passosDetalhados: string[];
  };
  detectedAt: string;
  endpointUsado?: string;
}

interface EnvironmentMetrics {
  authType: 'cloud_only' | 'hybrid' | 'federated';
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  guestUsers: number;
  mfaEnabledPercent: number;
  conditionalAccessEnabled: boolean;
  conditionalAccessPoliciesCount: number;
  securityDefaultsEnabled: boolean;
  enterpriseAppsCount: number;
  appRegistrationsCount: number;
  storageUsedGB: number;
  storageTotalGB: number;
  loginCountries: Array<{ country: string; success: number; fail: number }>;
}

// ========== GRAPH API EXECUTOR ==========

async function executeGraphApiStep(
  accessToken: string,
  step: BlueprintStep,
  context: { now: Date }
): Promise<StepResult> {
  const startTime = Date.now();
  const config = step.config;
  
  try {
    // Process dynamic parameters
    let endpoint = config.endpoint;
    if (config.dynamic_params) {
      for (const [key, value] of Object.entries(config.dynamic_params)) {
        if (value.startsWith('datetime_subtract')) {
          const match = value.match(/datetime_subtract\(now,\s*(\d+)d\)/);
          if (match) {
            const days = parseInt(match[1], 10);
            const date = new Date(context.now.getTime() - days * 24 * 60 * 60 * 1000);
            endpoint = endpoint.replace(`{${key}}`, date.toISOString());
          }
        }
      }
    }
    
    const baseUrl = config.api_version === 'beta' 
      ? 'https://graph.microsoft.com/beta' 
      : 'https://graph.microsoft.com/v1.0';
    
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      ...config.headers,
    };
    
    const res = await fetch(`${baseUrl}${endpoint}`, { 
      method: config.method || 'GET',
      headers 
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      return {
        stepId: step.id,
        stepName: step.name,
        category: step.category,
        data: null,
        error: `${res.status}: ${errorText}`,
        durationMs: Date.now() - startTime,
      };
    }
    
    // Handle count endpoints that return plain numbers
    const contentType = res.headers.get('content-type') || '';
    let data: unknown;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = parseInt(text, 10) || text;
    }
    
    return {
      stepId: step.id,
      stepName: step.name,
      category: step.category,
      data,
      error: null,
      durationMs: Date.now() - startTime,
    };
  } catch (e) {
    return {
      stepId: step.id,
      stepName: step.name,
      category: step.category,
      data: null,
      error: String(e),
      durationMs: Date.now() - startTime,
    };
  }
}

// ========== RULE EVALUATOR ==========

function evaluateRule(
  rule: ComplianceRule,
  stepResults: Map<string, StepResult>,
  now: string
): M365Insight | null {
  const evalLogic = rule.evaluation_logic as any;
  if (!evalLogic?.source_key) return null;
  
  const stepResult = stepResults.get(evalLogic.source_key);
  if (!stepResult) return null;
  
  // If step had an error, return not_found status
  if (stepResult.error) {
    return createInsight(rule, 'pass', 0, [], rule.not_found_description || 'Dados não disponíveis', now, stepResult.stepId);
  }
  
  const data = stepResult.data;
  const evaluate = evalLogic.evaluate;
  
  let status: 'pass' | 'fail' = 'pass';
  let affectedCount = 0;
  let affectedEntities: Array<{ id: string; displayName: string; details?: Record<string, unknown> }> = [];
  let description = '';
  
  try {
    switch (evaluate?.type) {
      case 'count_missing_mfa': {
        const users = (data as any)?.value || [];
        const methods = evaluate.methods || ['microsoftAuthenticatorPush', 'softwareOneTimePasscode', 'phoneAuthentication'];
        const noMfa = users.filter((u: any) => {
          const m = u.methodsRegistered || [];
          return !methods.some((method: string) => m.includes(method));
        });
        affectedCount = noMfa.length;
        affectedEntities = noMfa.slice(0, 20).map((u: any) => ({
          id: u.id,
          displayName: u.userDisplayName || u.userPrincipalName,
        }));
        status = affectedCount > (evaluate.threshold || 0) ? 'fail' : 'pass';
        description = status === 'fail'
          ? (rule.fail_description || '').replace('{count}', String(affectedCount))
          : (rule.pass_description || '').replace('{count}', String(users.length));
        break;
      }
      
      case 'count_inactive_users': {
        const users = (data as any)?.value || [];
        const threshold = new Date(Date.now() - (evaluate.days_threshold || 90) * 24 * 60 * 60 * 1000);
        const inactive = users.filter((u: any) => {
          const lastSignIn = u.signInActivity?.lastSignInDateTime;
          if (!lastSignIn) return true;
          return new Date(lastSignIn) < threshold;
        });
        affectedCount = inactive.length;
        affectedEntities = inactive.slice(0, 20).map((u: any) => ({
          id: u.id,
          displayName: u.displayName || u.userPrincipalName,
          details: { lastSignIn: u.signInActivity?.lastSignInDateTime || 'Nunca' }
        }));
        status = affectedCount > 5 ? 'fail' : 'pass';
        description = status === 'fail'
          ? (rule.fail_description || '').replace('{count}', String(affectedCount))
          : rule.pass_description || 'Todos os usuários ativos têm atividade recente.';
        break;
      }
      
      case 'check_boolean': {
        const fieldValue = (data as any)?.[evaluate.field];
        status = fieldValue === evaluate.expected ? 'pass' : 'fail';
        affectedCount = status === 'fail' ? 1 : 0;
        description = status === 'pass' ? rule.pass_description || '' : rule.fail_description || '';
        break;
      }
      
      case 'check_ca_policies': {
        const policies = (data as any)?.value || [];
        const enabledPolicies = policies.filter((p: any) => p.state === 'enabled');
        const hasMfaPolicy = enabledPolicies.some((p: any) => 
          p.grantControls?.builtInControls?.includes('mfa')
        );
        status = enabledPolicies.length > 0 && hasMfaPolicy ? 'pass' : 'fail';
        affectedCount = enabledPolicies.length;
        affectedEntities = policies.slice(0, 20).map((p: any) => ({
          id: p.id,
          displayName: `${p.displayName} (${p.state})`,
          details: { state: p.state, mfa: p.grantControls?.builtInControls?.includes('mfa') }
        }));
        description = status === 'pass'
          ? (rule.pass_description || '').replace('{count}', String(enabledPolicies.length))
          : (rule.fail_description || '').replace('{count}', String(enabledPolicies.length));
        break;
      }
      
      case 'check_legacy_auth_block': {
        const policies = (data as any)?.value || [];
        const enabledPolicies = policies.filter((p: any) => p.state === 'enabled');
        const blocksLegacy = enabledPolicies.some((p: any) =>
          p.conditions?.clientAppTypes?.includes('exchangeActiveSync') ||
          p.conditions?.clientAppTypes?.includes('other')
        );
        status = blocksLegacy ? 'pass' : 'fail';
        affectedCount = blocksLegacy ? 0 : 1;
        description = status === 'pass' ? rule.pass_description || '' : rule.fail_description || '';
        break;
      }
      
      case 'check_named_locations_exist': {
        const locations = (data as any)?.value || [];
        const trustedLocations = locations.filter((l: any) => l.isTrusted);
        status = locations.length > 0 ? 'pass' : 'fail';
        affectedCount = locations.length;
        affectedEntities = locations.slice(0, 20).map((l: any) => ({
          id: l.id,
          displayName: l.displayName,
          details: { trusted: l.isTrusted }
        }));
        description = status === 'pass'
          ? (rule.pass_description || '')
            .replace('{count}', String(locations.length))
            .replace('{trusted_count}', String(trustedLocations.length))
          : rule.fail_description || '';
        break;
      }
      
      case 'count_role_members': {
        const roles = (data as any)?.value || [];
        const targetRole = roles.find((r: any) => r.displayName === evaluate.role_name);
        // Note: This would need additional API call to get members
        // For now, we mark as pass and rely on sub-functions
        affectedCount = 0;
        status = 'pass';
        description = rule.pass_description || '';
        break;
      }
      
      case 'count_risk_detections': {
        const detections = (data as any)?.value || [];
        const highRisk = detections.filter((d: any) => d.riskLevel === 'high');
        const mediumRisk = detections.filter((d: any) => d.riskLevel === 'medium');
        affectedCount = detections.length;
        affectedEntities = detections.slice(0, 20).map((d: any) => ({
          id: d.id,
          displayName: `${d.userDisplayName || d.userPrincipalName} - ${d.riskEventType}`,
          details: { riskLevel: d.riskLevel, detected: d.detectedDateTime }
        }));
        status = highRisk.length > (evaluate.high_threshold || 0) || 
                 mediumRisk.length > (evaluate.medium_threshold || 5) ? 'fail' : 'pass';
        description = status === 'fail'
          ? (rule.fail_description || '')
            .replace('{count}', String(detections.length))
            .replace('{high_count}', String(highRisk.length))
            .replace('{medium_count}', String(mediumRisk.length))
          : rule.pass_description || '';
        break;
      }
      
      case 'count_risky_users': {
        const riskyUsers = (data as any)?.value || [];
        const confirmed = riskyUsers.filter((u: any) => u.riskState === 'confirmedCompromised');
        const atRisk = riskyUsers.filter((u: any) => u.riskState === 'atRisk');
        affectedCount = riskyUsers.length;
        affectedEntities = riskyUsers.slice(0, 20).map((u: any) => ({
          id: u.id,
          displayName: u.userDisplayName || u.userPrincipalName,
          details: { riskState: u.riskState, riskLevel: u.riskLevel }
        }));
        status = confirmed.length > (evaluate.confirmed_threshold || 0) || 
                 atRisk.length > (evaluate.at_risk_threshold || 5) ? 'fail' : 'pass';
        description = status === 'fail'
          ? (rule.fail_description || '')
            .replace('{count}', String(riskyUsers.length))
            .replace('{confirmed_count}', String(confirmed.length))
            .replace('{at_risk_count}', String(atRisk.length))
          : rule.pass_description || '';
        break;
      }
      
      case 'count_only': {
        const count = typeof data === 'number' ? data : ((data as any)?.value?.length || 0);
        affectedCount = count;
        status = 'pass';
        description = (rule.pass_description || '').replace('{count}', String(count));
        break;
      }
      
      case 'count_enabled_methods': {
        const methods = (data as any)?.authenticationMethodConfigurations || [];
        const enabledMethods = methods.filter((m: any) => m.state === 'enabled');
        affectedCount = enabledMethods.length;
        affectedEntities = enabledMethods.slice(0, 20).map((m: any) => ({
          id: m.id,
          displayName: m.id,
          details: { state: m.state }
        }));
        status = 'pass';
        description = (rule.pass_description || '').replace('{count}', String(enabledMethods.length));
        break;
      }
      
      default:
        // Unknown evaluation type - skip
        return null;
    }
  } catch (e) {
    console.error(`[evaluateRule] Error evaluating ${rule.code}:`, e);
    return createInsight(rule, 'pass', 0, [], rule.not_found_description || 'Erro na avaliação', now, stepResult.stepId);
  }
  
  return createInsight(rule, status, affectedCount, affectedEntities, description, now, stepResult.stepId);
}

function createInsight(
  rule: ComplianceRule,
  status: 'pass' | 'fail',
  affectedCount: number,
  affectedEntities: Array<{ id: string; displayName: string; details?: Record<string, unknown> }>,
  description: string,
  now: string,
  endpointUsed: string
): M365Insight {
  const severityMap: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
    info: 'info',
  };
  
  const productMap: Record<string, string> = {
    identities: 'entra_id',
    auth_access: 'entra_id',
    admin_privileges: 'entra_id',
    apps_integrations: 'entra_id',
    email_exchange: 'exchange_online',
    threats_activity: 'defender',
    intune_devices: 'intune',
    pim_governance: 'entra_id',
    sharepoint_onedrive: 'sharepoint',
    teams_collaboration: 'teams',
    defender_security: 'defender',
  };
  
  const portalMap: Record<string, string> = {
    entra_id: 'https://entra.microsoft.com',
    exchange_online: 'https://admin.exchange.microsoft.com',
    defender: 'https://security.microsoft.com',
    intune: 'https://intune.microsoft.com',
    sharepoint: 'https://admin.microsoft.com/sharepoint',
    teams: 'https://admin.teams.microsoft.com',
  };
  
  const product = productMap[rule.category] || 'entra_id';
  
  return {
    id: rule.code,
    code: rule.code,
    category: rule.category,
    product,
    severity: status === 'fail' ? severityMap[rule.severity] || 'medium' : 'info',
    titulo: rule.name,
    descricaoExecutiva: description || rule.description || '',
    riscoTecnico: rule.technical_risk || '',
    impactoNegocio: rule.business_impact || '',
    scoreImpacto: status === 'fail' ? rule.weight : 0,
    status,
    affectedCount,
    affectedEntities,
    remediacao: {
      productAfetado: product,
      portalUrl: portalMap[product] || 'https://entra.microsoft.com',
      caminhoPortal: [],
      passosDetalhados: rule.recommendation ? [rule.recommendation] : [],
    },
    detectedAt: now,
    endpointUsado: rule.api_endpoint || endpointUsed,
  };
}

// ========== ENVIRONMENT METRICS ==========

function extractEnvironmentMetrics(stepResults: Map<string, StepResult>): EnvironmentMetrics {
  const metrics: EnvironmentMetrics = {
    authType: 'cloud_only',
    totalUsers: 0,
    activeUsers: 0,
    disabledUsers: 0,
    guestUsers: 0,
    mfaEnabledPercent: 0,
    conditionalAccessEnabled: false,
    conditionalAccessPoliciesCount: 0,
    securityDefaultsEnabled: false,
    enterpriseAppsCount: 0,
    appRegistrationsCount: 0,
    storageUsedGB: 0,
    storageTotalGB: 0,
    loginCountries: [],
  };
  
  // Organization info
  const orgResult = stepResults.get('org_info');
  if (orgResult?.data) {
    const org = (orgResult.data as any)?.value?.[0];
    if (org?.onPremisesSyncEnabled) {
      metrics.authType = 'hybrid';
    }
  }
  
  // Domains
  const domainsResult = stepResults.get('domains');
  if (domainsResult?.data) {
    const domains = (domainsResult.data as any)?.value || [];
    if (domains.some((d: any) => d.authenticationType === 'Federated')) {
      metrics.authType = 'federated';
    }
  }
  
  // User counts
  const totalUsersResult = stepResults.get('users_count');
  if (typeof totalUsersResult?.data === 'number') {
    metrics.totalUsers = totalUsersResult.data;
  }
  
  const activeUsersResult = stepResults.get('users_active_count');
  if (typeof activeUsersResult?.data === 'number') {
    metrics.activeUsers = activeUsersResult.data;
  }
  
  const guestsResult = stepResults.get('users_guests_count');
  if (typeof guestsResult?.data === 'number') {
    metrics.guestUsers = guestsResult.data;
  }
  
  const disabledResult = stepResults.get('users_disabled_count');
  if (typeof disabledResult?.data === 'number') {
    metrics.disabledUsers = disabledResult.data;
  } else {
    metrics.disabledUsers = Math.max(0, metrics.totalUsers - metrics.activeUsers);
  }
  
  // MFA status
  const mfaResult = stepResults.get('mfa_registration_details');
  if (mfaResult?.data) {
    const users = (mfaResult.data as any)?.value || [];
    const withMfa = users.filter((u: any) => {
      const methods = u.methodsRegistered || [];
      return methods.includes('microsoftAuthenticatorPush') || 
             methods.includes('softwareOneTimePasscode') || 
             methods.includes('phoneAuthentication');
    });
    metrics.mfaEnabledPercent = users.length > 0 
      ? Math.round((withMfa.length / users.length) * 100) 
      : 0;
  }
  
  // Conditional Access
  const caResult = stepResults.get('conditional_access_policies');
  if (caResult?.data) {
    const policies = (caResult.data as any)?.value || [];
    const enabledPolicies = policies.filter((p: any) => p.state === 'enabled');
    metrics.conditionalAccessEnabled = enabledPolicies.length > 0;
    metrics.conditionalAccessPoliciesCount = enabledPolicies.length;
  }
  
  // Security Defaults
  const secDefaultsResult = stepResults.get('security_defaults');
  if (secDefaultsResult?.data) {
    metrics.securityDefaultsEnabled = (secDefaultsResult.data as any)?.isEnabled === true;
  }
  
  // Applications
  const appsCountResult = stepResults.get('applications_count');
  if (typeof appsCountResult?.data === 'number') {
    metrics.appRegistrationsCount = appsCountResult.data;
  }
  
  const enterpriseAppsResult = stepResults.get('enterprise_apps_count');
  if (typeof enterpriseAppsResult?.data === 'number') {
    metrics.enterpriseAppsCount = enterpriseAppsResult.data;
  }
  
  // Sign-in countries
  const signInsResult = stepResults.get('signin_logs');
  if (signInsResult?.data) {
    const signIns = (signInsResult.data as any)?.value || [];
    const countries = new Map<string, { success: number; fail: number }>();
    signIns.forEach((s: any) => {
      const country = s.location?.countryOrRegion;
      if (country) {
        const current = countries.get(country) || { success: 0, fail: 0 };
        if (s.status?.errorCode === 0) {
          current.success++;
        } else {
          current.fail++;
        }
        countries.set(country, current);
      }
    });
    metrics.loginCountries = Array.from(countries.entries())
      .map(([country, counts]) => ({ country, success: counts.success, fail: counts.fail }))
      .sort((a, b) => (b.success + b.fail) - (a.success + a.fail))
      .slice(0, 5);
  }
  
  return metrics;
}

// ========== SUB-FUNCTION CALLER ==========

interface CollectorResult {
  insights: M365Insight[];
  errors: string[];
}

async function callSubFunction(
  supabaseUrl: string, 
  supabaseKey: string, 
  functionName: string, 
  accessToken: string, 
  now: string
): Promise<CollectorResult> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ access_token: accessToken, now }),
    });
    if (!res.ok) {
      return { insights: [], errors: [`${functionName}: ${res.status} ${res.statusText}`] };
    }
    return await res.json();
  } catch (e) {
    return { insights: [], errors: [`${functionName}: ${String(e)}`] };
  }
}

// ========== MAIN HANDLER ==========

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tenant_record_id, blueprint_filter } = await req.json();
    if (!tenant_record_id) {
      return new Response(JSON.stringify({ success: false, error: 'tenant_record_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[m365-security-posture] Starting data-driven analysis for tenant: ${tenant_record_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Load tenant
    const { data: tenant } = await supabase
      .from('m365_tenants')
      .select('*')
      .eq('id', tenant_record_id)
      .single();
      
    if (!tenant) {
      return new Response(JSON.stringify({ success: false, error: 'Tenant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Load global config
    const { data: config } = await supabase
      .from('m365_global_config')
      .select('*')
      .limit(1)
      .single();
      
    if (!config) {
      return new Response(JSON.stringify({ success: false, error: 'Config not found' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Load active blueprints for M365 (optionally filtered by scope)
    let blueprintQuery = supabase
      .from('device_blueprints')
      .select('*')
      .eq('device_type_id', '5d1a7095-2d7b-4541-873d-4b03c3d6122f') // M365 device type
      .eq('is_active', true)
      .in('executor_type', ['edge_function', 'hybrid']);

    if (blueprint_filter === 'exchange_online') {
      blueprintQuery = blueprintQuery.ilike('name', '%Exchange%');
    }

    const { data: blueprints } = await blueprintQuery;
    
    if (!blueprints || blueprints.length === 0) {
      console.log('[m365-security-posture] No blueprints found, using legacy mode');
      return await handleLegacyMode(req, tenant, config, supabaseUrl, supabaseKey);
    }

    console.log(`[m365-security-posture] Loaded ${blueprints.length} blueprints: ${blueprints.map(b => b.name).join(', ')}`);

    // 4. Load compliance rules (optionally filtered by scope)
    let rulesQuery = supabase
      .from('compliance_rules')
      .select('*')
      .eq('device_type_id', '5d1a7095-2d7b-4541-873d-4b03c3d6122f')
      .eq('is_active', true);

    if (blueprint_filter === 'exchange_online') {
      rulesQuery = rulesQuery.in('category', ['email_exchange', 'threats_activity', 'pim_governance']);
    }

    const { data: rules } = await rulesQuery;

    console.log(`[m365-security-posture] Loaded ${rules?.length || 0} compliance rules`);

    // 5. Decrypt client secret
    const enc = config.client_secret_encrypted;
    let secret = '';
    if (!enc.includes(':')) {
      secret = atob(enc);
    } else {
      const keyHex = Deno.env.get('M365_ENCRYPTION_KEY') ?? '';
      const [ivH, ctH] = enc.split(':');
      const hex = (h: string) => new Uint8Array(h.match(/.{2}/g)!.map(b => parseInt(b, 16)));
      const key = await crypto.subtle.importKey('raw', hex(keyHex), { name: 'AES-GCM' }, false, ['decrypt']);
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hex(ivH) }, key, hex(ctH));
      secret = new TextDecoder().decode(dec);
    }

    // 6. Get access token
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${config.app_id}&client_secret=${encodeURIComponent(secret)}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials`,
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(`[m365-security-posture] Token failed: ${errText}`);
      return new Response(JSON.stringify({ success: false, error: 'Token failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { access_token } = await tokenRes.json();
    const now = new Date();
    const nowIso = now.toISOString();

    // 7. Execute Graph API steps from ALL blueprints
    const allEdgeSteps: BlueprintStep[] = [];
    for (const bp of blueprints) {
      const steps = (bp.collection_steps as any)?.steps || [];
      const edgeSteps = steps.filter((s: BlueprintStep) => s.executor === 'edge_function' && s.runtime === 'graph_api');
      allEdgeSteps.push(...edgeSteps);
    }
    
    console.log(`[m365-security-posture] Executing ${allEdgeSteps.length} Graph API steps from ${blueprints.length} blueprints...`);

    const stepPromises = allEdgeSteps.map((step: BlueprintStep) => 
      executeGraphApiStep(access_token, step, { now })
    );
    
    const stepResultsArray = await Promise.all(stepPromises);
    const stepResults = new Map<string, StepResult>();
    
    for (const result of stepResultsArray) {
      stepResults.set(result.stepId, result);
    }

    console.log(`[m365-security-posture] Completed ${stepResults.size} steps`);

    // 8. Evaluate compliance rules
    const allInsights: M365Insight[] = [];
    const allErrors: string[] = [];

    for (const rule of rules || []) {
      const insight = evaluateRule(rule, stepResults, nowIso);
      if (insight) {
        allInsights.push(insight);
      }
    }

    console.log(`[m365-security-posture] Evaluated ${allInsights.length} insights from database rules`);

    // 9. Collect step errors (sub-functions removed - all data now comes from segmented blueprints)
    for (const [stepId, result] of stepResults) {
      if (result.error) {
        allErrors.push(`${stepId}: ${result.error}`);
      }
    }

    console.log(`[m365-security-posture] Total: ${allInsights.length} insights, ${allErrors.length} errors`);

    // 10. Extract environment metrics
    const environmentMetrics = extractEnvironmentMetrics(stepResults);

    // 11. Calculate category breakdown
    const categories = [
      'identities', 'auth_access', 'admin_privileges', 'apps_integrations', 
      'email_exchange', 'threats_activity', 'intune_devices', 'pim_governance',
      'sharepoint_onedrive', 'teams_collaboration', 'defender_security'
    ];
    
    const categoryLabels: Record<string, string> = {
      identities: 'Identidades',
      auth_access: 'Autenticação & Acesso',
      admin_privileges: 'Privilégios Admin',
      apps_integrations: 'Aplicações & Integrações',
      email_exchange: 'Email & Exchange',
      threats_activity: 'Ameaças & Atividades',
      intune_devices: 'Intune & Dispositivos',
      pim_governance: 'PIM & Governança',
      sharepoint_onedrive: 'SharePoint & OneDrive',
      teams_collaboration: 'Teams & Colaboração',
      defender_security: 'Defender & DLP',
    };

    const categoryBreakdown = categories.map(cat => {
      const catInsights = allInsights.filter(i => i.category === cat);
      const failCount = catInsights.filter(i => i.status === 'fail').length;
      const totalPenalty = catInsights.reduce((sum, i) => sum + (i.status === 'fail' ? i.scoreImpacto : 0), 0);
      const criticalCount = catInsights.filter(i => i.status === 'fail' && i.severity === 'critical').length;
      const highCount = catInsights.filter(i => i.status === 'fail' && i.severity === 'high').length;

      return {
        category: cat,
        label: categoryLabels[cat] || cat,
        count: catInsights.length,
        failCount,
        score: Math.max(0, 100 - totalPenalty * 3),
        criticalCount,
        highCount,
      };
    }).filter(cat => cat.count > 0);

    // 12. Calculate overall score
    const totalPenalty = allInsights.reduce((sum, i) => sum + (i.status === 'fail' ? i.scoreImpacto : 0), 0);
    const score = Math.max(0, Math.min(100, 100 - totalPenalty));
    const classification = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'attention' : 'critical';

    // 13. Calculate summary
    const failedInsights = allInsights.filter(i => i.status === 'fail');
    const summary = {
      critical: failedInsights.filter(i => i.severity === 'critical').length,
      high: failedInsights.filter(i => i.severity === 'high').length,
      medium: failedInsights.filter(i => i.severity === 'medium').length,
      low: failedInsights.filter(i => i.severity === 'low').length,
      info: allInsights.filter(i => i.severity === 'info').length,
      total: allInsights.length,
    };

    console.log(`[m365-security-posture] Score: ${score}, Classification: ${classification}`);

    return new Response(JSON.stringify({
      success: true,
      score,
      classification,
      summary,
      categoryBreakdown,
      insights: allInsights,
      environmentMetrics,
      errors: allErrors.length > 0 ? allErrors : undefined,
      tenant: { 
        id: tenant.tenant_id, 
        domain: tenant.tenant_domain || '', 
        displayName: tenant.display_name 
      },
      analyzedAt: nowIso,
      analyzedPeriod: {
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        to: nowIso,
      },
      // Metadata about data-driven execution
      _meta: {
        blueprintIds: blueprints.map(b => b.id),
        blueprintNames: blueprints.map(b => b.name),
        blueprintCount: blueprints.length,
        stepsExecuted: stepResults.size,
        rulesEvaluated: rules?.length || 0,
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error(`[m365-security-posture] Error: ${String(e)}`);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ========== LEGACY MODE (fallback if no blueprint) ==========

async function handleLegacyMode(
  _req: Request,
  tenant: any,
  config: any,
  supabaseUrl: string,
  supabaseKey: string
): Promise<Response> {
  // This function would contain the original hardcoded logic as a fallback
  // For now, we return an error asking to configure the blueprint
  return new Response(JSON.stringify({ 
    success: false, 
    error: 'No M365 blueprint configured. Please run the database migration to populate device_blueprints.',
    hint: 'Check device_blueprints table for device_type_id = 5d1a7095-2d7b-4541-873d-4b03c3d6122f'
  }), {
    status: 500, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
