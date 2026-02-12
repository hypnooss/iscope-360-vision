import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// Types
// ============================================

interface AnalyzerInsight {
  id: string;
  category: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  details?: string;
  sourceIPs?: string[];
  targetPorts?: number[];
  affectedUsers?: string[];
  count?: number;
  timeWindow?: string;
  recommendation?: string;
}

interface TopBlockedIP {
  ip: string;
  country?: string;
  count: number;
  targetPorts: number[];
}

// Sensitive ports
const SENSITIVE_PORTS = new Set([22, 23, 135, 139, 389, 445, 636, 1433, 1521, 3306, 3389, 5432, 5900, 8080, 8443]);
const PORT_SCAN_THRESHOLD = 10;
const BRUTE_FORCE_THRESHOLD = 5; // lowered from 10
const HIGH_VOLUME_AUTH_THRESHOLD = 20;
const HIGH_VOLUME_CONFIG_THRESHOLD = 50;
const HIGH_VOLUME_BLOCKED_THRESHOLD = 50; // lowered from 100

// ============================================
// Config change categories
// ============================================

function categorizeCfgPath(cfgpath: string): { category: string; label: string; severity: AnalyzerInsight['severity'] } {
  const p = cfgpath.toLowerCase();
  if (p.includes('firewall.policy') || p.includes('firewall.address') || p.includes('firewall.addrgrp') || p.includes('firewall.service'))
    return { category: 'Política de Firewall', label: 'Regras de acesso e objetos de firewall', severity: 'high' };
  if (p.includes('vpn.ipsec') || p.includes('vpn.ssl'))
    return { category: 'VPN', label: 'Configuração de túneis VPN', severity: 'high' };
  if (p.includes('system.admin') || p.includes('system.accprofile'))
    return { category: 'Administração', label: 'Contas e perfis administrativos', severity: 'critical' };
  if (p.includes('system.ha'))
    return { category: 'Alta Disponibilidade', label: 'Configuração de HA/cluster', severity: 'high' };
  if (p.includes('router.') || p.includes('system.interface'))
    return { category: 'Rede/Roteamento', label: 'Interfaces e rotas', severity: 'medium' };
  if (p.includes('system.'))
    return { category: 'Sistema', label: 'Configurações gerais do sistema', severity: 'low' };
  return { category: 'Outros', label: 'Outras configurações', severity: 'low' };
}

// ============================================
// Analysis Modules
// ============================================

function analyzeDeniedTraffic(logs: any[]): { insights: AnalyzerInsight[]; metrics: Partial<Record<string, any>> } {
  const insights: AnalyzerInsight[] = [];
  if (!Array.isArray(logs) || logs.length === 0) return { insights, metrics: { totalDenied: 0 } };

  const ipMap: Record<string, { count: number; ports: Set<number>; country?: string }> = {};

  for (const log of logs) {
    const srcip = log.srcip || log.src || log.source;
    const dstport = parseInt(log.dstport || log.dst_port || log.service_port || '0');
    const country = log.srccountry || log.src_country || undefined;
    if (!srcip) continue;

    if (!ipMap[srcip]) ipMap[srcip] = { count: 0, ports: new Set(), country };
    ipMap[srcip].count++;
    if (dstport > 0) ipMap[srcip].ports.add(dstport);
  }

  const topBlockedIPs: TopBlockedIP[] = Object.entries(ipMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([ip, data]) => ({
      ip,
      country: data.country,
      count: data.count,
      targetPorts: [...data.ports].sort((a, b) => a - b),
    }));

  // Port scans
  for (const [ip, data] of Object.entries(ipMap)) {
    if (data.ports.size >= PORT_SCAN_THRESHOLD) {
      insights.push({
        id: `portscan_${ip}`,
        category: 'denied_traffic',
        name: 'Port Scan Detectado',
        description: `IP ${ip} tentou ${data.ports.size} portas diferentes`,
        severity: 'critical',
        sourceIPs: [ip],
        targetPorts: [...data.ports].sort((a, b) => a - b).slice(0, 20),
        count: data.count,
        recommendation: 'Considere bloquear este IP no firewall e investigar a origem.',
      });
    }
  }

  // Sensitive port attacks
  for (const [ip, data] of Object.entries(ipMap)) {
    const sensitivePorts = [...data.ports].filter(p => SENSITIVE_PORTS.has(p));
    if (sensitivePorts.length > 0 && data.count >= 5) {
      insights.push({
        id: `sensitive_${ip}`,
        category: 'denied_traffic',
        name: 'Tentativa em Porta Sensível',
        description: `IP ${ip} realizou ${data.count} tentativas para portas sensíveis: ${sensitivePorts.join(', ')}`,
        severity: data.count > 50 ? 'high' : 'medium',
        sourceIPs: [ip],
        targetPorts: sensitivePorts,
        count: data.count,
        recommendation: 'Verifique se estes serviços devem estar expostos externamente.',
      });
    }
  }

  // High-volume blocked IPs (threshold lowered to 50)
  for (const [ip, data] of Object.entries(ipMap)) {
    if (data.count >= HIGH_VOLUME_BLOCKED_THRESHOLD) {
      insights.push({
        id: `highvol_${ip}`,
        category: 'denied_traffic',
        name: 'Volume Alto de Bloqueios',
        description: `IP ${ip} teve ${data.count} tentativas bloqueadas`,
        severity: data.count >= 500 ? 'high' : 'medium',
        sourceIPs: [ip],
        count: data.count,
      });
    }
  }

  // Top countries
  const countryMap: Record<string, number> = {};
  for (const data of Object.values(ipMap)) {
    if (data.country) countryMap[data.country] = (countryMap[data.country] || 0) + data.count;
  }
  const topCountries = Object.entries(countryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([country, count]) => ({ country, count }));

  return {
    insights,
    metrics: {
      totalDenied: logs.length,
      topBlockedIPs,
      topCountries,
    },
  };
}

function analyzeAuthentication(authLogs: any[], vpnLogs: any[]): { insights: AnalyzerInsight[]; metrics: Partial<Record<string, any>> } {
  const insights: AnalyzerInsight[] = [];
  const safeAuth = Array.isArray(authLogs) ? authLogs : [];
  const safeVpn = Array.isArray(vpnLogs) ? vpnLogs : [];
  if (safeAuth.length === 0 && safeVpn.length === 0) return { insights, metrics: { vpnFailures: 0, firewallAuthFailures: 0, topAuthIPs: [], topAuthCountries: [] } };

  const isFailure = (l: any) => {
    const action = (l.action || l.status || '').toLowerCase();
    const logdesc = (l.logdesc || l.msg || '').toLowerCase();
    return action.includes('deny') || action.includes('fail') || logdesc.includes('fail') || logdesc.includes('denied');
  };

  // Separate firewall admin login failures vs VPN failures
  const firewallFailures = safeAuth.filter(isFailure);
  const vpnOnlyFailures = safeVpn.filter(isFailure);

  // Collect IPs and countries from both sources for top auth rankings
  const authIPMap: Record<string, { count: number; country?: string; ports: Set<number> }> = {};
  const authCountryMap: Record<string, number> = {};

  const collectIPData = (logs: any[]) => {
    for (const log of logs) {
      const ip = log.srcip || log.remip || log.src;
      const country = log.srccountry || log.src_country || undefined;
      if (!ip) continue;
      if (!authIPMap[ip]) authIPMap[ip] = { count: 0, country, ports: new Set() };
      authIPMap[ip].count++;
      const port = parseInt(log.dstport || log.dst_port || '0');
      if (port > 0) authIPMap[ip].ports.add(port);
      if (country) authCountryMap[country] = (authCountryMap[country] || 0) + 1;
    }
  };
  collectIPData(firewallFailures);
  collectIPData(vpnOnlyFailures);

  const topAuthIPs = Object.entries(authIPMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([ip, data]) => ({ ip, country: data.country, count: data.count, targetPorts: [...data.ports].sort((a, b) => a - b) }));

  const topAuthCountries = Object.entries(authCountryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([country, count]) => ({ country, count }));

  // Group failures by user for brute force detection
  const groupByUser = (logs: any[]) => {
    const map: Record<string, { count: number; ips: Set<string> }> = {};
    for (const log of logs) {
      const user = log.user || log.username || log.srcuser || 'unknown';
      if (!map[user]) map[user] = { count: 0, ips: new Set() };
      map[user].count++;
      const ip = log.srcip || log.remip || log.src;
      if (ip) map[user].ips.add(ip);
    }
    return map;
  };

  const fwUserFailures = groupByUser(firewallFailures);
  const vpnUserFailures = groupByUser(vpnOnlyFailures);

  // Brute force per user (both sources)
  const detectBruteForce = (userMap: Record<string, { count: number; ips: Set<string> }>, source: string) => {
    for (const [user, data] of Object.entries(userMap)) {
      if (data.count >= BRUTE_FORCE_THRESHOLD) {
        insights.push({
          id: `bruteforce_${source}_${user}`,
          category: 'authentication',
          name: `Possível Brute Force (${source})`,
          description: `Usuário "${user}" teve ${data.count} falhas de login via ${source}`,
          severity: data.count >= 50 ? 'critical' : data.count >= 20 ? 'high' : 'medium',
          affectedUsers: [user],
          sourceIPs: [...data.ips],
          count: data.count,
          recommendation: 'Verifique se a conta está comprometida. Considere bloqueio temporário.',
        });
      }
    }
  };
  detectBruteForce(fwUserFailures, 'Firewall');
  detectBruteForce(vpnUserFailures, 'VPN');

  // High volume firewall auth failures insight
  if (firewallFailures.length >= HIGH_VOLUME_AUTH_THRESHOLD) {
    const topUsers = Object.entries(fwUserFailures).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
    const topUsersDesc = topUsers.map(([user, data]) => `${user} (${data.count} falhas, IPs: ${[...data.ips].slice(0, 3).join(', ')})`).join('; ');
    insights.push({
      id: 'high_volume_firewall_auth_failures',
      category: 'authentication',
      name: 'Alto Volume de Falhas de Login no Firewall',
      description: `${firewallFailures.length} falhas de login administrativo detectadas no período`,
      severity: firewallFailures.length >= 100 ? 'critical' : firewallFailures.length >= 50 ? 'high' : 'medium',
      count: firewallFailures.length,
      details: `Top usuários: ${topUsersDesc}`,
      affectedUsers: topUsers.map(([u]) => u),
      recommendation: 'Investigue tentativas de acesso não autorizado ao painel administrativo do firewall.',
    });
  }

  // High volume VPN failures insight
  if (vpnOnlyFailures.length >= HIGH_VOLUME_AUTH_THRESHOLD) {
    // Detect VPN type breakdown
    let sslCount = 0, ipsecCount = 0, otherCount = 0;
    for (const log of vpnOnlyFailures) {
      const tunnel = (log.tunneltype || log.logdesc || log.msg || '').toLowerCase();
      if (tunnel.includes('ssl')) sslCount++;
      else if (tunnel.includes('ipsec')) ipsecCount++;
      else otherCount++;
    }
    const typeBreakdown = [sslCount > 0 ? `SSL: ${sslCount}` : '', ipsecCount > 0 ? `IPsec: ${ipsecCount}` : '', otherCount > 0 ? `Outros: ${otherCount}` : ''].filter(Boolean).join(', ');

    const topUsers = Object.entries(vpnUserFailures).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
    const topUsersDesc = topUsers.map(([user, data]) => `${user} (${data.count} falhas)`).join('; ');
    insights.push({
      id: 'high_volume_vpn_failures',
      category: 'authentication',
      name: 'Alto Volume de Falhas de VPN',
      description: `${vpnOnlyFailures.length} falhas de VPN detectadas no período`,
      severity: vpnOnlyFailures.length >= 100 ? 'critical' : vpnOnlyFailures.length >= 50 ? 'high' : 'medium',
      count: vpnOnlyFailures.length,
      details: `Tipos: ${typeBreakdown}. Top usuários: ${topUsersDesc}`,
      affectedUsers: topUsers.map(([u]) => u),
      recommendation: 'Investigue a origem das falhas de VPN. Verifique credenciais e configurações de acesso remoto.',
    });
  }

  // Detect admin login via WAN
  const allLogs = [...safeAuth, ...safeVpn];
  for (const log of allLogs) {
    const user = (log.user || log.username || '').toLowerCase();
    const ui = (log.ui || log.interface || '').toLowerCase();
    const action = (log.action || log.status || '').toLowerCase();
    
    if ((user.includes('admin') || log.group === 'admin') && (ui.includes('wan') || ui.includes('external')) && action.includes('success')) {
      insights.push({
        id: `admin_wan_${user}`,
        category: 'authentication',
        name: 'Login Admin via WAN',
        description: `Administrador "${user}" autenticou via interface pública`,
        severity: 'critical',
        affectedUsers: [user],
        sourceIPs: [log.srcip || log.remip].filter(Boolean),
        recommendation: 'Login admin via WAN é um risco crítico. Restrinja acesso administrativo à LAN.',
      });
      break;
    }
  }

  return {
    insights,
    metrics: {
      vpnFailures: vpnOnlyFailures.length,
      firewallAuthFailures: firewallFailures.length,
      topAuthIPs,
      topAuthCountries,
    },
  };
}

function analyzeIPS(logs: any[]): { insights: AnalyzerInsight[]; metrics: Partial<Record<string, any>> } {
  const insights: AnalyzerInsight[] = [];
  if (!Array.isArray(logs) || logs.length === 0) return { insights, metrics: { ipsEvents: 0 } };

  const attackMap: Record<string, { count: number; severity: string; srcIPs: Set<string>; dstIPs: Set<string> }> = {};

  for (const log of logs) {
    const attack = log.attack || log.msg || log.logdesc || 'unknown';
    const severity = (log.severity || log.crseverity || '').toString();
    
    if (!attackMap[attack]) attackMap[attack] = { count: 0, severity, srcIPs: new Set(), dstIPs: new Set() };
    attackMap[attack].count++;
    if (log.srcip) attackMap[attack].srcIPs.add(log.srcip);
    if (log.dstip) attackMap[attack].dstIPs.add(log.dstip);
  }

  // C2 patterns
  for (const log of logs) {
    const msg = ((log.msg || '') + ' ' + (log.attack || '')).toLowerCase();
    if (msg.includes('command') && msg.includes('control') || msg.includes('c2') || msg.includes('beacon') || msg.includes('botnet')) {
      insights.push({
        id: `c2_${log.srcip || 'unknown'}`,
        category: 'ips_ids',
        name: 'Comunicação C2 Detectada',
        description: `Possível comunicação com servidor de Comando e Controle: ${log.msg || log.attack}`,
        severity: 'critical',
        sourceIPs: [log.srcip].filter(Boolean),
        details: `Destino: ${log.dstip || 'N/A'}, Porta: ${log.dstport || 'N/A'}`,
        recommendation: 'Isole o host imediatamente e investigue possível comprometimento.',
      });
    }
  }

  // Per attack type
  for (const [attack, data] of Object.entries(attackMap)) {
    const sevNum = parseInt(data.severity);
    const mappedSeverity: AnalyzerInsight['severity'] = 
      sevNum <= 1 ? 'critical' : sevNum <= 2 ? 'high' : sevNum <= 3 ? 'medium' : 'low';

    insights.push({
      id: `ips_${attack.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}`,
      category: 'ips_ids',
      name: attack.length > 60 ? attack.slice(0, 57) + '...' : attack,
      description: `${data.count} evento(s) detectado(s) afetando ${data.dstIPs.size} host(s) interno(s)`,
      severity: mappedSeverity,
      sourceIPs: [...data.srcIPs].slice(0, 10),
      count: data.count,
    });
  }

  return {
    insights,
    metrics: { ipsEvents: logs.length },
  };
}

function analyzeConfigChanges(logs: any[]): { insights: AnalyzerInsight[]; metrics: Partial<Record<string, any>> } {
  const insights: AnalyzerInsight[] = [];
  if (!Array.isArray(logs) || logs.length === 0) return { insights, metrics: { configChanges: 0 } };

  // === Categorize by cfgpath for FortiGate-specific parsing ===
  const cfgCategories: Record<string, { count: number; users: Set<string>; objects: Set<string>; actions: Set<string> }> = {};

  for (const log of logs) {
    const msg = (log.msg || log.logdesc || log.action || '').toLowerCase();
    const user = log.user || log.ui || 'unknown';
    const cfgpath = log.cfgpath || '';
    const cfgobj = log.cfgobj || '';
    const cfgattr = log.cfgattr || '';
    const logAction = (log.action || '').toLowerCase();

    // --- FortiGate cfgpath-based detection ---
    if (cfgpath) {
      const cat = categorizeCfgPath(cfgpath);
      const key = cat.category;
      if (!cfgCategories[key]) cfgCategories[key] = { count: 0, users: new Set(), objects: new Set(), actions: new Set() };
      cfgCategories[key].count++;
      cfgCategories[key].users.add(user);
      if (cfgobj) cfgCategories[key].objects.add(`${cfgpath}:${cfgobj}`);
      if (logAction) cfgCategories[key].actions.add(logAction);
    }

    // --- Legacy msg-based detection ---
    // Detect admin creation
    if (msg.includes('add') && msg.includes('admin')) {
      insights.push({
        id: `newadmin_${user}`,
        category: 'config_changes',
        name: 'Novo Admin Criado',
        description: `Usuário admin criado por "${user}"`,
        severity: 'high',
        affectedUsers: [user],
        recommendation: 'Verifique se esta ação foi autorizada.',
      });
    }

    // Detect policy/rule changes (expanded keywords)
    if (msg.includes('policy') || msg.includes('rule') || msg.includes('firewall') ||
        msg.includes('edit') || msg.includes('set') || msg.includes('delete') ||
        msg.includes('modify') || msg.includes('add')) {
      // Only create individual insight for critical keywords (policy/rule/firewall/admin)
      if (msg.includes('policy') || msg.includes('rule') || msg.includes('firewall')) {
        insights.push({
          id: `configchg_${log.logid || log.id || Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          category: 'config_changes',
          name: 'Alteração de Política',
          description: `Alteração detectada: ${log.msg || log.logdesc || 'política de segurança modificada'}`,
          severity: 'medium',
          affectedUsers: [user],
          details: `Usuário: ${user}, Ação: ${log.action || 'N/A'}${cfgpath ? `, Path: ${cfgpath}` : ''}${cfgobj ? `, Objeto: ${cfgobj}` : ''}`,
        });
      }
    }
  }

  // === NEW: Generate insights per cfgpath category ===
  for (const [catName, data] of Object.entries(cfgCategories)) {
    if (data.count >= 1) {
      const cat = categorizeCfgPath(
        catName === 'Política de Firewall' ? 'firewall.policy' :
        catName === 'VPN' ? 'vpn.ipsec' :
        catName === 'Administração' ? 'system.admin' :
        catName === 'Alta Disponibilidade' ? 'system.ha' :
        catName === 'Rede/Roteamento' ? 'router.static' :
        catName === 'Sistema' ? 'system.global' : 'other'
      );

      const objectsList = [...data.objects].slice(0, 5).join(', ');

      insights.push({
        id: `cfgcat_${catName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
        category: 'config_changes',
        name: `Alterações em ${catName}`,
        description: `${data.count} alteração(ões) em ${catName.toLowerCase()} por ${data.users.size} usuário(s)`,
        severity: cat.severity,
        count: data.count,
        affectedUsers: [...data.users],
        details: objectsList ? `Objetos alterados: ${objectsList}` : undefined,
        recommendation: catName === 'Administração'
          ? 'Alterações administrativas devem ser auditadas com rigor. Verifique se foram autorizadas.'
          : catName === 'Política de Firewall'
          ? 'Mudanças em políticas de firewall podem abrir brechas de segurança. Revise as alterações.'
          : undefined,
      });
    }
  }

  // Filter real modifications (not reads/queries)
  const MODIFY_ACTIONS = ['add', 'edit', 'delete', 'set', 'move', 'modify', 'create', 'remove'];
  const realChanges = logs.filter(log => {
    const action = (log.action || '').toLowerCase();
    const msg = (log.msg || log.logdesc || '').toLowerCase();
    // If action field exists, use it; otherwise check msg for modification keywords
    if (action) return MODIFY_ACTIONS.some(a => action.includes(a));
    return MODIFY_ACTIONS.some(a => msg.includes(a));
  });

  const realCount = realChanges.length > 0 ? realChanges.length : logs.length;

  // === Aggregate high-volume config changes insight ===
  if (realCount >= HIGH_VOLUME_CONFIG_THRESHOLD) {
    const allUsers = new Set<string>();
    for (const log of (realChanges.length > 0 ? realChanges : logs)) {
      allUsers.add(log.user || log.ui || 'unknown');
    }

    insights.push({
      id: 'high_volume_config_changes',
      category: 'config_changes',
      name: 'Volume Elevado de Alterações',
      description: `${realCount} alterações de configuração detectadas no período`,
      severity: realCount >= 200 ? 'high' : 'medium',
      count: realCount,
      affectedUsers: [...allUsers],
      details: `Realizado por ${allUsers.size} usuário(s). Categorias: ${Object.keys(cfgCategories).join(', ') || 'não categorizadas'}`,
      recommendation: 'Um volume alto de alterações pode indicar manutenção programada ou atividade não autorizada. Revise o contexto.',
    });
  }

  return {
    insights,
    metrics: { configChanges: realCount },
  };
}

// ============================================
// Score Calculation
// ============================================

function calculateScore(insights: AnalyzerInsight[]): number {
  if (insights.length === 0) return 100;

  let penalty = 0;
  for (const i of insights) {
    switch (i.severity) {
      case 'critical': penalty += 15; break;
      case 'high': penalty += 8; break;
      case 'medium': penalty += 3; break;
      case 'low': penalty += 1; break;
    }
  }

  return Math.max(0, Math.min(100, 100 - penalty));
}

// ============================================
// Main Handler
// ============================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { snapshot_id, task_id, raw_data } = await req.json();

    if (!snapshot_id || !raw_data) {
      return new Response(
        JSON.stringify({ success: false, error: 'snapshot_id and raw_data required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[firewall-analyzer] Processing snapshot ${snapshot_id}`);

    await supabase.from('analyzer_snapshots').update({ status: 'processing' }).eq('id', snapshot_id);

    // Extract step data
    const deniedData = raw_data.denied_traffic?.data || raw_data.denied_traffic || [];
    const authData = raw_data.auth_events?.data || raw_data.auth_events || [];
    const vpnData = raw_data.vpn_events?.data || raw_data.vpn_events || [];
    const ipsData = raw_data.ips_events?.data || raw_data.ips_events || [];
    const configData = raw_data.config_changes?.data || raw_data.config_changes || [];

    // Run analysis modules
    const deniedResult = analyzeDeniedTraffic(Array.isArray(deniedData) ? deniedData : deniedData?.results || []);
    const authResult = analyzeAuthentication(
      Array.isArray(authData) ? authData : authData?.results || [],
      Array.isArray(vpnData) ? vpnData : vpnData?.results || [],
    );
    const ipsResult = analyzeIPS(Array.isArray(ipsData) ? ipsData : ipsData?.results || []);
    const configResult = analyzeConfigChanges(Array.isArray(configData) ? configData : configData?.results || []);

    // Combine all insights
    const allInsights = [
      ...deniedResult.insights,
      ...authResult.insights,
      ...ipsResult.insights,
      ...configResult.insights,
    ];

    // Deduplicate by id
    const uniqueInsights = [...new Map(allInsights.map(i => [i.id, i])).values()];

    const summary = {
      critical: uniqueInsights.filter(i => i.severity === 'critical').length,
      high: uniqueInsights.filter(i => i.severity === 'high').length,
      medium: uniqueInsights.filter(i => i.severity === 'medium').length,
      low: uniqueInsights.filter(i => i.severity === 'low').length,
      info: uniqueInsights.filter(i => i.severity === 'info').length,
    };

    const metrics = {
      topBlockedIPs: deniedResult.metrics.topBlockedIPs || [],
      topCountries: deniedResult.metrics.topCountries || [],
      vpnFailures: authResult.metrics.vpnFailures || 0,
      firewallAuthFailures: authResult.metrics.firewallAuthFailures || 0,
      topAuthIPs: authResult.metrics.topAuthIPs || [],
      topAuthCountries: authResult.metrics.topAuthCountries || [],
      ipsEvents: ipsResult.metrics.ipsEvents || 0,
      configChanges: configResult.metrics.configChanges || 0,
      totalDenied: deniedResult.metrics.totalDenied || 0,
      totalEvents: (deniedResult.metrics.totalDenied || 0) + (authResult.metrics.vpnFailures || 0) + (authResult.metrics.firewallAuthFailures || 0) + (ipsResult.metrics.ipsEvents || 0) + (configResult.metrics.configChanges || 0),
    };

    const score = calculateScore(uniqueInsights);

    const { error: updateError } = await supabase
      .from('analyzer_snapshots')
      .update({
        status: 'completed',
        score,
        summary,
        insights: uniqueInsights,
        metrics,
      })
      .eq('id', snapshot_id);

    if (updateError) {
      console.error('[firewall-analyzer] Failed to save:', updateError);
      await supabase.from('analyzer_snapshots').update({ status: 'failed' }).eq('id', snapshot_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save results' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[firewall-analyzer] Completed: score=${score}, insights=${uniqueInsights.length}, critical=${summary.critical}`);

    return new Response(
      JSON.stringify({ success: true, score, summary, insights_count: uniqueInsights.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[firewall-analyzer] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
