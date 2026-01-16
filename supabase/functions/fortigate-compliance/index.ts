import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FortiGateConfig {
  url: string;
  apiKey: string;
}

interface EvidenceItem {
  label: string;
  value: string;
  type?: "text" | "code" | "list" | "json";
}

interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "pass" | "fail" | "warning" | "pending";
  severity: "critical" | "high" | "medium" | "low";
  recommendation?: string;
  details?: string;
  evidence?: EvidenceItem[];
  rawData?: Record<string, unknown>;
  apiEndpoint?: string;
}

interface InterfaceClassification {
  name: string;
  role: "wan" | "lan" | "dmz" | "undefined";
  reason: string;
}

interface InboundWANPolicy {
  policyid: number;
  name: string;
  srcintf: string[];
  dstintf: string[];
  hasIPS: boolean;
  ipsSensor: string;
  utmStatus: string;
}

// Função customizada para fazer fetch ignorando SSL (FortiGates usam certificados auto-assinados)
async function fetchWithoutSSLVerification(url: string, options: RequestInit): Promise<Response> {
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
    client.close();
  }
}

// Função para fazer requisição à API do FortiGate
async function fortigateRequest(config: FortiGateConfig, endpoint: string) {
  const url = `${config.url}/api/v2${endpoint}`;
  console.log(`Fetching: ${url}`);

  const response = await fetchWithoutSSLVerification(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`FortiGate API error: ${response.status} - ${text}`);
    throw new Error(`FortiGate API error: ${response.status}`);
  }

  return await response.json();
}

// ==================== CLASSIFICAÇÃO DE INTERFACES ====================
// Classifica interfaces conforme prioridade:
// 1. virtual-wan-link → WAN
// 2. SD-WAN members → WAN
// 3. Campo role da API
// 4. Nome indicando WAN (wan, wan1, wan2, internet, isp) → WAN
// 5. Caso contrário → undefined

async function classifyInterfaces(config: FortiGateConfig): Promise<{
  classifications: InterfaceClassification[];
  wanInterfaceNames: Set<string>;
  sdwanMembers: string[];
}> {
  const classifications: InterfaceClassification[] = [];
  const wanInterfaceNames = new Set<string>();
  const sdwanMembers: string[] = [];

  try {
    const interfaces = await fortigateRequest(config, "/cmdb/system/interface");
    const sdwanConfig = await fortigateRequest(config, "/cmdb/system/sdwan").catch(() => ({ results: {} }));

    // Identificar membros do SD-WAN
    const sdwan = sdwanConfig.results || {};
    const members = sdwan.members || [];
    for (const member of members) {
      if (member.interface) {
        sdwanMembers.push(member.interface);
      }
    }

    // Adicionar zones SD-WAN
    const zones = sdwan.zone || [];
    for (const zone of zones) {
      if (zone.name) {
        wanInterfaceNames.add(zone.name);
      }
    }

    // Sempre incluir virtual-wan-link
    wanInterfaceNames.add("virtual-wan-link");

    // Padrões de nome que indicam WAN
    const wanNamePatterns = /^(wan|wan\d+|internet|isp|isp\d+|mpls|lte|4g|5g|broadband)/i;

    for (const iface of interfaces.results || []) {
      let role: "wan" | "lan" | "dmz" | "undefined" = "undefined";
      let reason = "";

      // Prioridade 1: virtual-wan-link
      if (iface.name === "virtual-wan-link") {
        role = "wan";
        reason = "Interface virtual-wan-link (SD-WAN)";
      }
      // Prioridade 2: Membro do SD-WAN
      else if (sdwanMembers.includes(iface.name)) {
        role = "wan";
        reason = "Membro do SD-WAN";
      }
      // Prioridade 3: Campo role da API
      else if (iface.role && iface.role !== "undefined") {
        role = iface.role.toLowerCase() as "wan" | "lan" | "dmz";
        reason = `Definido na configuração (role=${iface.role})`;
      }
      // Prioridade 4: Nome indica WAN
      else if (wanNamePatterns.test(iface.name)) {
        role = "wan";
        reason = "Nome da interface indica WAN";
      }
      // Prioridade 5: undefined
      else {
        role = "undefined";
        reason = "Role não definido";
      }

      classifications.push({
        name: iface.name,
        role,
        reason,
      });

      if (role === "wan") {
        wanInterfaceNames.add(iface.name);
      }
    }

    console.log("Interface classifications:", classifications.map((c) => `${c.name}=${c.role}`).join(", "));
    console.log("WAN interfaces:", Array.from(wanInterfaceNames));
  } catch (error) {
    console.error("Error classifying interfaces:", error);
  }

  return { classifications, wanInterfaceNames, sdwanMembers };
}

// ==================== IDENTIFICAÇÃO DE INBOUND WAN ====================
// Uma policy é Inbound WAN se:
// - status = enable
// - action = accept
// - srcintf contém virtual-wan-link OU referencia interface WAN
// - NÃO é túnel VPN (REMOTE-VPN, etc.)

function isVPNTunnel(interfaceName: string): boolean {
  // Padrões comuns de túneis VPN
  const vpnPatterns = /^(vpn|ipsec|ssl\.|remote|tunnel|gre|l2tp|pptp)/i;
  return vpnPatterns.test(interfaceName);
}

function identifyInboundWANPolicies(policies: any[], wanInterfaceNames: Set<string>): InboundWANPolicy[] {
  const inboundWAN: InboundWANPolicy[] = [];

  for (const policy of policies) {
    // Verificar status e action
    if (policy.status !== "enable" || policy.action !== "accept") {
      continue;
    }

    // Extrair interfaces de origem
    const srcintf = policy.srcintf?.map((i: any) => i.name) || [];
    const dstintf = policy.dstintf?.map((i: any) => i.name) || [];

    // Verificar se é VPN (excluir)
    const isFromVPN = srcintf.some((name: string) => isVPNTunnel(name));
    if (isFromVPN) {
      continue;
    }

    // Verificar se srcintf contém interface WAN
    const isFromWAN = srcintf.some((name: string) => wanInterfaceNames.has(name));

    if (isFromWAN) {
      const hasIPS = policy["utm-status"] === "enable" && !!policy["ips-sensor"];

      inboundWAN.push({
        policyid: policy.policyid,
        name: policy.name || "Sem nome",
        srcintf,
        dstintf,
        hasIPS,
        ipsSensor: policy["ips-sensor"] || "",
        utmStatus: policy["utm-status"] || "disable",
      });
    }
  }

  console.log(`Identified ${inboundWAN.length} inbound WAN policies`);
  return inboundWAN;
}

// ==================== VERIFICAÇÃO DE BACKUP AUTOMÁTICO ====================
// Verifica automation-stitch/trigger/action para backup configurado

interface BackupConfig {
  isConfigured: boolean;
  status: "active" | "inactive" | "not_configured";
  frequency: string;
  detail: string;
  stitchName: string;
  triggerName: string;
  actionName: string;
}

async function checkAutomatedBackup(config: FortiGateConfig): Promise<BackupConfig> {
  const result: BackupConfig = {
    isConfigured: false,
    status: "not_configured",
    frequency: "",
    detail: "Backup automático não configurado",
    stitchName: "",
    triggerName: "",
    actionName: "",
  };

  try {
    // Buscar automation stitches
    const stitchesResponse = await fortigateRequest(config, "/cmdb/system/automation-stitch").catch(() => ({
      results: [],
    }));
    const triggersResponse = await fortigateRequest(config, "/cmdb/system/automation-trigger").catch(() => ({
      results: [],
    }));
    const actionsResponse = await fortigateRequest(config, "/cmdb/system/automation-action").catch(() => ({
      results: [],
    }));

    const stitches = stitchesResponse.results || [];
    const triggers = triggersResponse.results || [];
    const actions = actionsResponse.results || [];

    console.log(`[BACKUP] Found ${stitches.length} stitches, ${triggers.length} triggers, ${actions.length} actions`);
    console.log(`[BACKUP] Stitches: ${JSON.stringify(stitches.map((s: any) => ({ name: s.name, status: s.status, trigger: s.trigger, actions: s.actions || s.action })))}`);
    console.log(`[BACKUP] Triggers: ${JSON.stringify(triggers.map((t: any) => ({ name: t.name, type: t["trigger-type"] || t["event-type"], frequency: t["trigger-frequency"] })))}`);
    console.log(`[BACKUP] Actions: ${JSON.stringify(actions.map((a: any) => ({ name: a.name, type: a["action-type"], hasScript: !!a.script })))}`);

    // Mapear triggers por nome
    const triggerMap = new Map<string, any>();
    for (const trigger of triggers) {
      triggerMap.set(trigger.name, trigger);
    }

    // Mapear actions por nome
    const actionMap = new Map<string, any>();
    for (const action of actions) {
      actionMap.set(action.name, action);
    }

    // Procurar stitch de backup
    for (const stitch of stitches) {
      // Aceitar tanto "enable" quanto sem status explícito (alguns FortiGates não retornam)
      if (stitch.status && stitch.status !== "enable") continue;

      // Verificar trigger associado - pode ser array ou objeto direto
      let triggerRefs = stitch.trigger || stitch.triggers || [];
      if (!Array.isArray(triggerRefs)) {
        triggerRefs = [triggerRefs];
      }
      
      // Verificar actions - pode ser "actions" ou "action", array ou objeto
      let actionRefs = stitch.actions || stitch.action || [];
      if (!Array.isArray(actionRefs)) {
        actionRefs = [actionRefs];
      }

      console.log(`[BACKUP] Checking stitch: ${stitch.name}, triggers: ${JSON.stringify(triggerRefs)}, actions: ${JSON.stringify(actionRefs)}`);

      for (const triggerRef of triggerRefs) {
        const triggerName = typeof triggerRef === "string" ? triggerRef : triggerRef?.name;
        if (!triggerName) continue;
        
        const trigger = triggerMap.get(triggerName);

        if (!trigger) {
          console.log(`[BACKUP] Trigger not found in map: ${triggerName}`);
          continue;
        }

        // Verificar se é trigger agendado - aceitar variações
        const triggerType = trigger["trigger-type"] || trigger["event-type"] || trigger.type || "";
        console.log(`[BACKUP] Trigger ${triggerName} type: ${triggerType}`);
        
        // Aceitar "scheduled", "schedule", ou trigger com frequência definida
        const hasScheduledFrequency = trigger["trigger-frequency"] || trigger.frequency;
        const isScheduled = triggerType === "scheduled" || triggerType === "schedule" || hasScheduledFrequency;
        
        if (!isScheduled) {
          console.log(`[BACKUP] Trigger ${triggerName} is not scheduled`);
          continue;
        }

        // Verificar ações de backup
        for (const actionRef of actionRefs) {
          // O actionRef pode ser:
          // - string: nome da action diretamente
          // - objeto com "name": { name: "Backup" }
          // - objeto com "action": { action: "Backup", id: 1, ... } (formato real do FortiGate!)
          let actionName = "";
          if (typeof actionRef === "string") {
            actionName = actionRef;
          } else if (actionRef?.action) {
            // Formato real: { id: 1, action: "Backup", ... }
            actionName = actionRef.action;
          } else if (actionRef?.name) {
            actionName = actionRef.name;
          }
          
          console.log(`[BACKUP] Extracted action name: "${actionName}" from ref: ${JSON.stringify(actionRef)}`);
          
          if (!actionName) continue;
          
          const action = actionMap.get(actionName);

          if (!action) {
            console.log(`[BACKUP] Action not found in map: ${actionName}`);
            // Mesmo sem action no map, verificar se nome indica backup
            if (actionName.toLowerCase().includes("backup")) {
              result.isConfigured = true;
              result.status = "active";
              result.stitchName = stitch.name;
              result.triggerName = triggerName;
              result.actionName = actionName;
              
              const frequency = trigger["trigger-frequency"] || trigger.frequency || "daily";
              const triggerDay = trigger["trigger-day"] || trigger["trigger-weekday"] || trigger.weekday || "";
              const triggerHour = trigger["trigger-hour"] ?? trigger.hour ?? 0;
              const triggerMinute = trigger["trigger-minute"] ?? trigger.minute ?? 0;
              
              result.frequency = frequency;
              const timeStr = `${String(triggerHour).padStart(2, "0")}:${String(triggerMinute).padStart(2, "0")}`;
              
              if (frequency === "weekly" && triggerDay) {
                result.detail = `${frequency} on ${triggerDay} at ${timeStr}`;
              } else {
                result.detail = `${frequency} at ${timeStr}`;
              }
              
              console.log(`[BACKUP] Found backup by action name: ${result.stitchName} -> ${result.detail}`);
              return result;
            }
            continue;
          }

          // Verificar se é ação de backup
          const actionType = action["action-type"] || action.type || "";
          const script = action.script || action.command || "";
          
          console.log(`[BACKUP] Checking action: ${actionName}, type: ${actionType}, script contains backup: ${script.toLowerCase().includes("backup")}`);

          // Verificar se é ação de backup por múltiplos critérios
          const isBackupAction =
            // cli-script com execute backup config
            (actionType === "cli-script" && script.toLowerCase().includes("execute backup")) ||
            (actionType === "cli-script" && script.toLowerCase().includes("backup config")) ||
            // Nome indica backup
            actionName.toLowerCase().includes("backup") ||
            // Script contém backup
            script.toLowerCase().includes("backup") ||
            // Tipo específico de backup (alguns FortiOS)
            actionType === "backup" ||
            actionType === "config-backup";

          if (!isBackupAction) {
            console.log(`[BACKUP] Action ${actionName} is not a backup action`);
            continue;
          }

          // Encontramos um backup automático válido!
          result.isConfigured = true;
          result.status = "active";
          result.stitchName = stitch.name;
          result.triggerName = triggerName;
          result.actionName = actionName;

          // Extrair frequência do trigger
          const frequency = trigger["trigger-frequency"] || trigger.frequency || "daily";
          const triggerDay = trigger["trigger-day"] || trigger["trigger-weekday"] || trigger.weekday || "";
          const triggerHour = trigger["trigger-hour"] ?? trigger.hour ?? 0;
          const triggerMinute = trigger["trigger-minute"] ?? trigger.minute ?? 0;

          result.frequency = frequency;

          // Formatar detalhe legível
          const timeStr = `${String(triggerHour).padStart(2, "0")}:${String(triggerMinute).padStart(2, "0")}`;
          if (frequency === "weekly" && triggerDay) {
            result.detail = `${frequency} on ${triggerDay} at ${timeStr}`;
          } else if (frequency === "monthly") {
            result.detail = `${frequency} at ${timeStr}`;
          } else {
            result.detail = `${frequency} at ${timeStr}`;
          }

          console.log(`[BACKUP] Found backup automation: ${result.stitchName} -> ${result.detail}`);
          return result;
        }
      }
    }

    // Fallback: verificar auto-script (método antigo)
    try {
      const autoScripts = await fortigateRequest(config, "/cmdb/system/auto-script");
      const scripts = autoScripts.results || [];
      console.log(`[BACKUP] Fallback: Found ${scripts.length} auto-scripts`);
      
      const backupScripts = scripts.filter(
        (s: any) => s.script?.toLowerCase().includes("backup") || s.name?.toLowerCase().includes("backup"),
      );

      if (backupScripts.length > 0) {
        const script = backupScripts[0];
        result.isConfigured = true;
        result.status = "active";
        result.stitchName = "auto-script";
        result.triggerName = script.name;
        result.actionName = script.name;
        result.frequency = "scheduled";
        result.detail = `Auto-script: ${script.name} (interval: ${script.interval || "N/A"})`;
        console.log(`[BACKUP] Found backup via auto-script: ${script.name}`);
      }
    } catch {
      // Endpoint não disponível
    }
    
    console.log(`[BACKUP] Final result: isConfigured=${result.isConfigured}, status=${result.status}`);
  } catch (error) {
    console.error("[BACKUP] Error checking automated backup:", error);
  }

  return result;
}

// Mascarar credenciais em scripts
function maskCredentials(script: string): string {
  // Mascarar senhas e tokens
  return script
    .replace(/password\s*=?\s*["']?[^"'\s]+["']?/gi, "password=***MASKED***")
    .replace(/token\s*=?\s*["']?[^"'\s]+["']?/gi, "token=***MASKED***")
    .replace(/key\s*=?\s*["']?[^"'\s]+["']?/gi, "key=***MASKED***")
    .replace(/secret\s*=?\s*["']?[^"'\s]+["']?/gi, "secret=***MASKED***");
}

// ==================== VERIFICAÇÕES DE COMPLIANCE ====================

// Verificar protocolos inseguros nas interfaces
async function checkInsecureProtocols(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];

  try {
    const interfaces = await fortigateRequest(config, "/cmdb/system/interface");

    const insecureHttpInterfaces: { name: string; allowaccess: string }[] = [];
    const insecureTelnetInterfaces: { name: string; allowaccess: string }[] = [];
    const sshWanInterfaces: { name: string; type: string; role: string; allowaccess: string }[] = [];
    const allInterfacesData: { name: string; allowaccess: string; type: string; role: string }[] = [];

    for (const iface of interfaces.results || []) {
      const allowAccess = iface.allowaccess || "";
      allInterfacesData.push({
        name: iface.name,
        allowaccess: allowAccess,
        type: iface.type || "N/A",
        role: iface.role || "N/A",
      });

      if (allowAccess.includes("http") && !allowAccess.includes("https")) {
        insecureHttpInterfaces.push({ name: iface.name, allowaccess: allowAccess });
      }
      if (allowAccess.includes("telnet")) {
        insecureTelnetInterfaces.push({ name: iface.name, allowaccess: allowAccess });
      }
      if (iface.type === "physical" && iface.role === "wan" && allowAccess.includes("ssh")) {
        sshWanInterfaces.push({ name: iface.name, type: iface.type, role: iface.role, allowaccess: allowAccess });
      }
    }

    checks.push({
      id: "int-001",
      name: "Protocolo HTTP na Interface de Gerência",
      description: "Verifica se HTTP (não criptografado) está habilitado nas interfaces",
      category: "Segurança de Interfaces",
      status: insecureHttpInterfaces.length > 0 ? "fail" : "pass",
      severity: "critical",
      recommendation:
        insecureHttpInterfaces.length > 0
          ? "Desabilitar HTTP e utilizar apenas HTTPS para acesso administrativo"
          : "Manter configuração atual",
      details:
        insecureHttpInterfaces.length > 0
          ? `HTTP habilitado nas interfaces: ${insecureHttpInterfaces.map((i) => i.name).join(", ")}`
          : "Nenhuma interface com HTTP inseguro",
      apiEndpoint: "/api/v2/cmdb/system/interface",
      evidence:
        insecureHttpInterfaces.length > 0
          ? insecureHttpInterfaces.map((i) => ({
              label: `Interface: ${i.name}`,
              value: `allowaccess: ${i.allowaccess}`,
              type: "code" as const,
            }))
          : [
              {
                label: "Interfaces analisadas",
                value: `${allInterfacesData.length} interfaces verificadas - nenhuma com HTTP inseguro`,
                type: "text" as const,
              },
            ],
      rawData: {
        interfaces: insecureHttpInterfaces.length > 0 ? insecureHttpInterfaces : allInterfacesData.slice(0, 5),
      },
    });

    checks.push({
      id: "int-002",
      name: "Protocolo Telnet Ativo",
      description: "Verifica se Telnet está habilitado nas interfaces de gerenciamento",
      category: "Segurança de Interfaces",
      status: insecureTelnetInterfaces.length > 0 ? "fail" : "pass",
      severity: "critical",
      recommendation:
        insecureTelnetInterfaces.length > 0
          ? "Desabilitar Telnet imediatamente e utilizar apenas SSH"
          : "Manter configuração atual",
      details:
        insecureTelnetInterfaces.length > 0
          ? `Telnet habilitado nas interfaces: ${insecureTelnetInterfaces.map((i) => i.name).join(", ")}`
          : "Telnet desabilitado em todas as interfaces",
      apiEndpoint: "/api/v2/cmdb/system/interface",
      evidence:
        insecureTelnetInterfaces.length > 0
          ? insecureTelnetInterfaces.map((i) => ({
              label: `Interface: ${i.name}`,
              value: `allowaccess: ${i.allowaccess}`,
              type: "code" as const,
            }))
          : [
              {
                label: "Interfaces analisadas",
                value: `${allInterfacesData.length} interfaces verificadas - nenhuma com Telnet`,
                type: "text" as const,
              },
            ],
      rawData: {
        interfaces: insecureTelnetInterfaces.length > 0 ? insecureTelnetInterfaces : allInterfacesData.slice(0, 5),
      },
    });

    checks.push({
      id: "int-003",
      name: "SSH em Interface Externa",
      description: "Verifica se SSH está exposto em interfaces WAN",
      category: "Segurança de Interfaces",
      status: sshWanInterfaces.length > 0 ? "warning" : "pass",
      severity: "high",
      recommendation:
        sshWanInterfaces.length > 0
          ? "Restringir acesso SSH apenas a IPs de gerenciamento confiáveis"
          : "Manter configuração atual",
      details:
        sshWanInterfaces.length > 0
          ? `SSH habilitado em interfaces WAN: ${sshWanInterfaces.map((i) => i.name).join(", ")}`
          : "SSH não exposto em interfaces WAN",
      apiEndpoint: "/api/v2/cmdb/system/interface",
      evidence:
        sshWanInterfaces.length > 0
          ? sshWanInterfaces.map((i) => ({
              label: `Interface: ${i.name}`,
              value: `type: ${i.type}, role: ${i.role}, allowaccess: ${i.allowaccess}`,
              type: "code" as const,
            }))
          : [
              {
                label: "Interfaces WAN analisadas",
                value: `Nenhuma interface WAN com SSH exposto`,
                type: "text" as const,
              },
            ],
      rawData: { wanInterfaces: sshWanInterfaces },
    });
  } catch (error) {
    console.error("Error checking interfaces:", error);
    checks.push({
      id: "int-err",
      name: "Erro ao verificar interfaces",
      description: "Não foi possível verificar a configuração das interfaces",
      category: "Segurança de Interfaces",
      status: "pending",
      severity: "high",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      apiEndpoint: "/api/v2/cmdb/system/interface",
    });
  }

  return checks;
}

async function checkFirewallRules(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];

  try {
    const policies = await fortigateRequest(config, "/cmdb/firewall/policy");

    const anySourceRules: { id: string; name: string; srcaddr: string; srcintf: string }[] = [];
    const rdpExposed: { id: string; name: string; srcaddr: string; service: string }[] = [];
    const smbExposed: { id: string; name: string; srcaddr: string; service: string }[] = [];
    const anyAnyRules: { id: string; name: string; srcaddr: string; dstaddr: string }[] = [];
    const totalPoliciesData: { id: string; name: string; srcaddr: string; dstaddr: string; service: string }[] = [];

    for (const policy of policies.results || []) {
      const srcaddr = policy.srcaddr?.map((s: any) => s.name).join(",") || "";
      const dstaddr = policy.dstaddr?.map((d: any) => d.name).join(",") || "";
      const service = policy.service?.map((s: any) => s.name).join(",") || "";
      const srcintf = policy.srcintf?.map((i: any) => i.name).join(",") || "";

      totalPoliciesData.push({
        id: `#${policy.policyid}`,
        name: policy.name || "Sem nome",
        srcaddr,
        dstaddr,
        service,
      });

      // Regras de entrada sem restrição
      if (srcaddr.includes("all") && srcintf.toLowerCase().includes("wan")) {
        anySourceRules.push({ id: `#${policy.policyid}`, name: policy.name || "Sem nome", srcaddr, srcintf });
      }

      // RDP exposto
      if (service.toLowerCase().includes("rdp") || service.includes("3389")) {
        if (srcaddr.includes("all")) {
          rdpExposed.push({ id: `#${policy.policyid}`, name: policy.name || "Sem nome", srcaddr, service });
        }
      }

      // SMB exposto
      if (service.toLowerCase().includes("smb") || service.includes("445") || service.includes("139")) {
        if (srcaddr.includes("all")) {
          smbExposed.push({ id: `#${policy.policyid}`, name: policy.name || "Sem nome", srcaddr, service });
        }
      }

      // Regras any-any
      if (srcaddr.includes("all") && dstaddr.includes("all")) {
        anyAnyRules.push({ id: `#${policy.policyid}`, name: policy.name || "Sem nome", srcaddr, dstaddr });
      }
    }

    checks.push({
      id: "inb-001",
      name: "Regras de Entrada sem Restrição de Origem",
      description: "Identifica regras de entrada (WAN→LAN) que aceitam qualquer IP de origem",
      category: "Regras de Entrada",
      status: anySourceRules.length > 0 ? "fail" : "pass",
      severity: "critical",
      recommendation:
        anySourceRules.length > 0
          ? "Restringir origem das regras para IPs ou ranges específicos"
          : "Manter configuração atual",
      details:
        anySourceRules.length > 0
          ? `${anySourceRules.length} regras com source "all": ${anySourceRules.map((r) => r.id).join(", ")}`
          : "Todas as regras possuem origem restrita",
      apiEndpoint: "/api/v2/cmdb/firewall/policy",
      evidence:
        anySourceRules.length > 0
          ? anySourceRules.map((r) => ({
              label: `Regra ${r.id}: ${r.name}`,
              value: `srcaddr: ${r.srcaddr}, srcintf: ${r.srcintf}`,
              type: "code" as const,
            }))
          : [
              {
                label: "Políticas analisadas",
                value: `${totalPoliciesData.length} regras verificadas - nenhuma com source "all" em interface WAN`,
                type: "text" as const,
              },
            ],
      rawData: { rules: anySourceRules.length > 0 ? anySourceRules : { total: totalPoliciesData.length } },
    });

    checks.push({
      id: "inb-002",
      name: "RDP Exposto para Internet",
      description: "Verifica se há regras expondo RDP (3389) para a internet",
      category: "Regras de Entrada",
      status: rdpExposed.length > 0 ? "fail" : "pass",
      severity: "critical",
      recommendation:
        rdpExposed.length > 0
          ? "Remover acesso RDP direto da internet. Utilizar VPN ou bastion host"
          : "Manter configuração atual",
      details:
        rdpExposed.length > 0
          ? `RDP exposto: ${rdpExposed.map((r) => r.id).join(", ")}`
          : "RDP não exposto para internet",
      apiEndpoint: "/api/v2/cmdb/firewall/policy",
      evidence:
        rdpExposed.length > 0
          ? rdpExposed.map((r) => ({
              label: `Regra ${r.id}: ${r.name}`,
              value: `srcaddr: ${r.srcaddr}, service: ${r.service}`,
              type: "code" as const,
            }))
          : [
              {
                label: "Verificação RDP",
                value: `Nenhuma regra encontrada com RDP/3389 exposto para "all"`,
                type: "text" as const,
              },
            ],
      rawData: { rules: rdpExposed },
    });

    checks.push({
      id: "inb-003",
      name: "SMB/CIFS Exposto para Internet",
      description: "Verifica se há regras expondo portas SMB (445, 139) para a internet",
      category: "Regras de Entrada",
      status: smbExposed.length > 0 ? "fail" : "pass",
      severity: "critical",
      recommendation:
        smbExposed.length > 0 ? "Bloquear imediatamente portas SMB da internet" : "Manter configuração atual",
      details:
        smbExposed.length > 0
          ? `SMB exposto: ${smbExposed.map((r) => r.id).join(", ")}`
          : "SMB não exposto para internet",
      apiEndpoint: "/api/v2/cmdb/firewall/policy",
      evidence:
        smbExposed.length > 0
          ? smbExposed.map((r) => ({
              label: `Regra ${r.id}: ${r.name}`,
              value: `srcaddr: ${r.srcaddr}, service: ${r.service}`,
              type: "code" as const,
            }))
          : [
              {
                label: "Verificação SMB",
                value: `Nenhuma regra encontrada com SMB/445/139 exposto para "all"`,
                type: "text" as const,
              },
            ],
      rawData: { rules: smbExposed },
    });

    checks.push({
      id: "net-003",
      name: 'Regras "Any-Any"',
      description: "Verifica existência de regras permissivas demais",
      category: "Configuração de Rede",
      status: anyAnyRules.length > 0 ? "fail" : "pass",
      severity: "critical",
      recommendation:
        anyAnyRules.length > 0 ? "Remover ou restringir regras any-any identificadas" : "Manter configuração atual",
      details:
        anyAnyRules.length > 0
          ? `${anyAnyRules.length} regras any-any: ${anyAnyRules.map((r) => r.id).join(", ")}`
          : "Nenhuma regra any-any encontrada",
      apiEndpoint: "/api/v2/cmdb/firewall/policy",
      evidence:
        anyAnyRules.length > 0
          ? anyAnyRules.map((r) => ({
              label: `Regra ${r.id}: ${r.name}`,
              value: `srcaddr: ${r.srcaddr}, dstaddr: ${r.dstaddr}`,
              type: "code" as const,
            }))
          : [
              {
                label: "Verificação Any-Any",
                value: `${totalPoliciesData.length} regras verificadas - nenhuma com srcaddr="all" E dstaddr="all"`,
                type: "text" as const,
              },
            ],
      rawData: { rules: anyAnyRules.length > 0 ? anyAnyRules : { total: totalPoliciesData.length } },
    });
  } catch (error) {
    console.error("Error checking firewall rules:", error);
    checks.push({
      id: "fw-err",
      name: "Erro ao verificar regras de firewall",
      description: "Não foi possível verificar as políticas de firewall",
      category: "Configuração de Rede",
      status: "pending",
      severity: "high",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      apiEndpoint: "/api/v2/cmdb/firewall/policy",
    });
  }

  return checks;
}

// Verificar configurações de segurança do admin
async function checkAdminSecurity(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];

  try {
    const adminSettings = await fortigateRequest(config, "/cmdb/system/global");
    const admins = await fortigateRequest(config, "/cmdb/system/admin");

    const settings = adminSettings.results || {};
    const adminList = admins.results || [];

    // 2FA
    const adminsWithout2FA = adminList.filter((a: any) => a["two-factor"] === "disable");
    const adminsWith2FA = adminList.filter((a: any) => a["two-factor"] !== "disable");

    checks.push({
      id: "sec-002",
      name: "Autenticação de Dois Fatores",
      description: "Verifica se 2FA está habilitado para acesso administrativo",
      category: "Políticas de Segurança",
      status: adminsWithout2FA.length > 0 ? "fail" : "pass",
      severity: "critical",
      recommendation:
        adminsWithout2FA.length > 0
          ? "Habilitar autenticação de dois fatores para todos os administradores"
          : "Manter configuração atual",
      details:
        adminsWithout2FA.length > 0
          ? `${adminList.length - adminsWithout2FA.length} de ${adminList.length} administradores possuem 2FA`
          : "Todos os administradores possuem 2FA habilitado",
      apiEndpoint: "/api/v2/cmdb/system/admin",
      evidence:
        adminsWithout2FA.length > 0
          ? adminsWithout2FA.map((a: any) => ({
              label: `Admin: ${a.name}`,
              value: `two-factor: ${a["two-factor"] || "disable"}, accprofile: ${a.accprofile || "N/A"}`,
              type: "code" as const,
            }))
          : adminList.map((a: any) => ({
              label: `Admin: ${a.name}`,
              value: `two-factor: ${a["two-factor"] || "N/A"}, accprofile: ${a.accprofile || "N/A"}`,
              type: "code" as const,
            })),
      rawData: {
        totalAdmins: adminList.length,
        with2FA: adminsWith2FA.length,
        without2FA: adminsWithout2FA.length,
        admins: adminList.map((a: any) => ({ name: a.name, twoFactor: a["two-factor"], accprofile: a.accprofile })),
      },
    });

    // Timeout de sessão
    const adminTimeout = settings["admin-lockout-threshold"] || 0;
    const admintimeout = settings.admintimeout || "N/A";

    checks.push({
      id: "sec-003",
      name: "Timeout de Sessão",
      description: "Verifica configuração de timeout de sessão administrativa",
      category: "Políticas de Segurança",
      status: adminTimeout > 30 ? "warning" : "pass",
      severity: "medium",
      recommendation: adminTimeout > 30 ? "Reduzir timeout de sessão para 15-30 minutos" : "Manter configuração atual",
      details: `Timeout atual: ${adminTimeout} minutos`,
      apiEndpoint: "/api/v2/cmdb/system/global",
      evidence: [
        {
          label: "Configuração de Timeout",
          value: `admin-lockout-threshold: ${adminTimeout}, admintimeout: ${admintimeout}`,
          type: "code" as const,
        },
      ],
      rawData: {
        adminLockoutThreshold: adminTimeout,
        admintimeout,
      },
    });

    // Política de senha
    const strongCrypto = settings["strong-crypto"] === "enable";

    checks.push({
      id: "sec-001",
      name: "Criptografia Forte",
      description: "Verifica se criptografia forte está habilitada",
      category: "Políticas de Segurança",
      status: strongCrypto ? "pass" : "warning",
      severity: "high",
      recommendation: !strongCrypto
        ? "Habilitar strong-crypto para forçar uso de algoritmos seguros"
        : "Manter configuração atual",
      apiEndpoint: "/api/v2/cmdb/system/global",
      evidence: [
        {
          label: "Configuração de Criptografia",
          value: `strong-crypto: ${settings["strong-crypto"] || "disable"}`,
          type: "code" as const,
        },
      ],
      rawData: {
        strongCrypto: settings["strong-crypto"],
        sslMinProtoVersion: settings["ssl-min-proto-version"],
      },
    });
  } catch (error) {
    console.error("Error checking admin security:", error);
    checks.push({
      id: "adm-err",
      name: "Erro ao verificar segurança administrativa",
      description: "Não foi possível verificar configurações de admin",
      category: "Políticas de Segurança",
      status: "pending",
      severity: "high",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      apiEndpoint: "/api/v2/cmdb/system/admin",
    });
  }

  return checks;
}

// Verificar configurações UTM (IPS, Web Filter, App Control) - CORRIGIDO PARA INBOUND WAN
async function checkUTMProfiles(config: FortiGateConfig, wanInterfaceNames: Set<string>): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];

  try {
    const policies = await fortigateRequest(config, "/cmdb/firewall/policy");
    const ipsProfiles = await fortigateRequest(config, "/cmdb/ips/sensor");

    const allPolicies = policies.results || [];
    const totalPolicies = allPolicies.length;

    // ==================== IPS/IDS - SOMENTE INBOUND WAN ====================
    const inboundWANPolicies = identifyInboundWANPolicies(allPolicies, wanInterfaceNames);
    const totalInboundWAN = inboundWANPolicies.length;
    const inboundWithIPS = inboundWANPolicies.filter((p) => p.hasIPS);
    const inboundWithoutIPS = inboundWANPolicies.filter((p) => !p.hasIPS);

    let ipsStatus: "pass" | "fail" | "warning" = "pass";
    let ipsDetails = "";
    let ipsRecommendation = "Manter configuração atual";

    if (totalInboundWAN === 0) {
      ipsStatus = "pass";
      ipsDetails = "Nenhuma política inbound WAN identificada";
    } else if (inboundWithIPS.length === 0) {
      ipsStatus = "fail";
      ipsDetails = `NENHUMA das ${totalInboundWAN} políticas inbound WAN possui IPS/IDS ativo`;
      ipsRecommendation = "Aplicar perfil IPS em todas as regras de tráfego inbound WAN";
    } else if (inboundWithIPS.length < totalInboundWAN) {
      ipsStatus = "warning";
      ipsDetails = `IPS ativo em ${inboundWithIPS.length} de ${totalInboundWAN} políticas inbound WAN`;
      ipsRecommendation = "Aplicar perfil IPS nas políticas inbound WAN sem proteção";
    } else {
      ipsDetails = `Todas as ${totalInboundWAN} políticas inbound WAN possuem IPS/IDS ativo`;
    }

    const ipsEvidence: EvidenceItem[] = [
      { label: "Total políticas inbound WAN", value: String(totalInboundWAN), type: "text" as const },
      { label: "Com IPS ativo", value: String(inboundWithIPS.length), type: "text" as const },
    ];

    if (inboundWithIPS.length > 0) {
      ipsEvidence.push({
        label: "Políticas protegidas",
        value: inboundWithIPS.map((p) => `#${p.policyid}: ${p.name} (${p.ipsSensor})`).join(", "),
        type: "code" as const,
      });
    }

    if (inboundWithoutIPS.length > 0) {
      ipsEvidence.push({
        label: "Políticas SEM IPS (inbound WAN)",
        value: inboundWithoutIPS
          .map((p) => `#${p.policyid}: ${p.name} (srcintf: ${p.srcintf.join(",")}, dstintf: ${p.dstintf.join(",")})`)
          .join(" | "),
        type: "code" as const,
      });
    }

    checks.push({
      id: "utm-001",
      name: "Perfil IPS/IDS Ativo (Inbound WAN)",
      description:
        "Verifica se perfis de Intrusion Prevention estão aplicados nas políticas de entrada da internet (inbound WAN)",
      category: "Perfis de Segurança UTM",
      status: ipsStatus,
      severity: "high",
      recommendation: ipsRecommendation,
      details: ipsDetails,
      apiEndpoint: "/api/v2/cmdb/firewall/policy",
      evidence: ipsEvidence,
      rawData: {
        totalInboundWAN,
        withIPS: inboundWithIPS.length,
        withoutIPS: inboundWithoutIPS.map((p) => ({
          policyid: p.policyid,
          name: p.name,
          srcintf: p.srcintf,
          dstintf: p.dstintf,
        })),
        ipsProfiles: (ipsProfiles.results || []).map((p: any) => p.name),
      },
    });

    // ==================== WEB FILTER - SAÍDA INTERNET ====================
    // Políticas de saída para internet (destino WAN)
    const internetOutboundPolicies = allPolicies.filter((p: any) => {
      const dstintf = p.dstintf?.map((i: any) => i.name) || [];
      return dstintf.some((ifname: string) => wanInterfaceNames.has(ifname));
    });
    const totalInternetPolicies = internetOutboundPolicies.length;

    const internetPoliciesWithWebFilter = internetOutboundPolicies.filter((p: any) => p["webfilter-profile"]);
    const internetPoliciesWithoutWebFilter = internetOutboundPolicies.filter((p: any) => !p["webfilter-profile"]);

    const webFilterStatus =
      totalInternetPolicies === 0
        ? "pass"
        : internetPoliciesWithWebFilter.length === 0
          ? "fail"
          : internetPoliciesWithWebFilter.length < totalInternetPolicies * 0.5
            ? "warning"
            : "pass";

    checks.push({
      id: "utm-004",
      name: "Web Filter Ativo",
      description: "Verifica se filtro de conteúdo web está aplicado nas políticas de saída para internet (WAN/SDWAN)",
      category: "Perfis de Segurança UTM",
      status: webFilterStatus,
      severity: "medium",
      recommendation:
        internetPoliciesWithWebFilter.length < totalInternetPolicies
          ? "Aplicar Web Filter em todas as políticas de acesso à internet"
          : "Manter configuração atual",
      details: `Web Filter aplicado em ${internetPoliciesWithWebFilter.length} de ${totalInternetPolicies} políticas de saída internet`,
      apiEndpoint: "/api/v2/cmdb/firewall/policy",
      evidence: [
        {
          label: "Interfaces WAN/SDWAN",
          value: Array.from(wanInterfaceNames).join(", ") || "Nenhuma identificada",
          type: "text" as const,
        },
        {
          label: "Com WebFilter",
          value:
            internetPoliciesWithWebFilter.map((p: any) => `#${p.policyid}: ${p["webfilter-profile"]}`).join(", ") ||
            "Nenhuma",
          type: "text" as const,
        },
        {
          label: "Sem WebFilter",
          value:
            internetPoliciesWithoutWebFilter
              .slice(0, 5)
              .map((p: any) => `#${p.policyid}: ${p.name || "Sem nome"}`)
              .join(", ") || "Nenhuma",
          type: "text" as const,
        },
      ],
      rawData: {
        total: totalPolicies,
        internetPolicies: totalInternetPolicies,
        withWebFilter: internetPoliciesWithWebFilter.length,
        wanInterfaces: Array.from(wanInterfaceNames),
      },
    });

    // ==================== APPLICATION CONTROL - SAÍDA INTERNET ====================
    const internetPoliciesWithAppCtrl = internetOutboundPolicies.filter((p: any) => p["application-list"]);
    const internetPoliciesWithoutAppCtrl = internetOutboundPolicies.filter((p: any) => !p["application-list"]);

    const appCtrlStatus =
      totalInternetPolicies === 0
        ? "pass"
        : internetPoliciesWithAppCtrl.length === 0
          ? "fail"
          : internetPoliciesWithAppCtrl.length < totalInternetPolicies * 0.5
            ? "warning"
            : "pass";

    checks.push({
      id: "utm-007",
      name: "Application Control Ativo",
      description: "Verifica se controle de aplicações está aplicado nas políticas de saída para internet (WAN/SDWAN)",
      category: "Perfis de Segurança UTM",
      status: appCtrlStatus,
      severity: "medium",
      recommendation:
        internetPoliciesWithAppCtrl.length < totalInternetPolicies
          ? "Aplicar Application Control para visibilidade e controle de aplicações de internet"
          : "Manter configuração atual",
      details: `Application Control aplicado em ${internetPoliciesWithAppCtrl.length} de ${totalInternetPolicies} políticas de saída internet`,
      apiEndpoint: "/api/v2/cmdb/firewall/policy",
      evidence: [
        {
          label: "Interfaces WAN/SDWAN",
          value: Array.from(wanInterfaceNames).join(", ") || "Nenhuma identificada",
          type: "text" as const,
        },
        {
          label: "Com AppControl",
          value:
            internetPoliciesWithAppCtrl.map((p: any) => `#${p.policyid}: ${p["application-list"]}`).join(", ") ||
            "Nenhuma",
          type: "text" as const,
        },
        {
          label: "Sem AppControl",
          value:
            internetPoliciesWithoutAppCtrl
              .slice(0, 5)
              .map((p: any) => `#${p.policyid}: ${p.name || "Sem nome"}`)
              .join(", ") || "Nenhuma",
          type: "text" as const,
        },
      ],
      rawData: {
        total: totalPolicies,
        internetPolicies: totalInternetPolicies,
        withAppControl: internetPoliciesWithAppCtrl.length,
        wanInterfaces: Array.from(wanInterfaceNames),
      },
    });

    // ==================== ANTIVÍRUS ====================
    const policiesWithAV = allPolicies.filter((p: any) => p["av-profile"]);
    const policiesWithoutAV = allPolicies.filter((p: any) => !p["av-profile"]);

    checks.push({
      id: "utm-009",
      name: "Antivírus de Gateway",
      description: "Verifica se antivírus está habilitado para escanear arquivos",
      category: "Perfis de Segurança UTM",
      status: policiesWithAV.length < totalPolicies * 0.5 ? "warning" : "pass",
      severity: "high",
      recommendation:
        policiesWithAV.length < totalPolicies
          ? "Aplicar perfil de antivírus em todas as políticas"
          : "Manter configuração atual",
      details: `Antivírus aplicado em ${policiesWithAV.length} de ${totalPolicies} políticas`,
      apiEndpoint: "/api/v2/cmdb/firewall/policy",
      evidence: [
        {
          label: "Com Antivírus",
          value: policiesWithAV.map((p: any) => `#${p.policyid}: ${p["av-profile"]}`).join(", ") || "Nenhuma",
          type: "text" as const,
        },
        {
          label: "Sem Antivírus",
          value:
            policiesWithoutAV
              .slice(0, 5)
              .map((p: any) => `#${p.policyid}: ${p.name || "Sem nome"}`)
              .join(", ") || "Nenhuma",
          type: "text" as const,
        },
      ],
      rawData: {
        total: totalPolicies,
        withAV: policiesWithAV.length,
      },
    });
  } catch (error) {
    console.error("Error checking UTM profiles:", error);
    checks.push({
      id: "utm-err",
      name: "Erro ao verificar perfis UTM",
      description: "Não foi possível verificar configurações UTM",
      category: "Perfis de Segurança UTM",
      status: "pending",
      severity: "high",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      apiEndpoint: "/api/v2/cmdb/firewall/policy",
    });
  }

  return checks;
}

// Verificar HA e Backup - ATUALIZADO COM AUTOMATION STITCH
async function checkHAAndBackup(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];

  try {
    // ==================== HA STATUS ====================
    const haStatus = await fortigateRequest(config, "/cmdb/system/ha");
    const haSettings = haStatus.results || {};

    const haMode = haSettings.mode || "standalone";
    const haGroupName = haSettings["group-name"] || "N/A";
    const haPriority = haSettings.priority || "N/A";
    const haSchedule = haSettings.schedule || "N/A";

    checks.push({
      id: "ha-001",
      name: "Cluster HA Configurado",
      description: "Verifica se alta disponibilidade está configurada",
      category: "Alta Disponibilidade",
      status: haMode === "standalone" ? "warning" : "pass",
      severity: "medium",
      recommendation:
        haMode === "standalone" ? "Considerar configurar HA para alta disponibilidade" : "Manter configuração atual",
      details: `Modo HA: ${haMode}`,
      apiEndpoint: "/api/v2/cmdb/system/ha",
      evidence: [
        { label: "Modo HA", value: haMode, type: "text" as const },
        { label: "Nome do Grupo", value: haGroupName, type: "text" as const },
        { label: "Prioridade", value: String(haPriority), type: "text" as const },
        { label: "Schedule", value: haSchedule, type: "text" as const },
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

    if (haMode !== "standalone") {
      const hbInterfaces = haSettings["hbdev"] || "";
      const hbInterfaceList = hbInterfaces.split(" ").filter((i: string) => i.trim());

      checks.push({
        id: "ha-003",
        name: "Heartbeat HA",
        description: "Verifica configuração dos links de heartbeat",
        category: "Alta Disponibilidade",
        status: hbInterfaceList.length < 2 ? "warning" : "pass",
        severity: "high",
        recommendation: "Configurar múltiplos links de heartbeat para redundância",
        details: `Interfaces de heartbeat: ${hbInterfaces || "Nenhuma configurada"}`,
        apiEndpoint: "/api/v2/cmdb/system/ha",
        evidence: [
          { label: "Interfaces Heartbeat", value: hbInterfaces || "Nenhuma", type: "code" as const },
          { label: "Quantidade", value: `${hbInterfaceList.length} interface(s)`, type: "text" as const },
        ],
        rawData: {
          hbdev: hbInterfaces,
          interfaceCount: hbInterfaceList.length,
        },
      });
    }

    // ==================== BACKUP AUTOMÁTICO - VIA AUTOMATION STITCH ====================
    const backupConfig = await checkAutomatedBackup(config);

    let backupStatus: "pass" | "fail" | "warning" = "fail";
    let backupDetails = "Backup automático não configurado";
    let backupRecommendation = "Configurar backup automático usando automation stitch com trigger agendado";

    if (backupConfig.isConfigured && backupConfig.status === "active") {
      backupStatus = "pass";
      backupDetails = `Backup Automático Ativo | Frequência: ${backupConfig.frequency} | ${backupConfig.detail}`;
      backupRecommendation = "Manter configuração atual";
    }

    const backupEvidence: EvidenceItem[] = [
      {
        label: "Status",
        value: backupConfig.status === "active" ? "✅ Ativo" : "❌ Não configurado",
        type: "text" as const,
      },
    ];

    if (backupConfig.isConfigured) {
      backupEvidence.push(
        { label: "Frequência", value: backupConfig.frequency, type: "text" as const },
        { label: "Detalhe", value: backupConfig.detail, type: "text" as const },
        { label: "Stitch", value: backupConfig.stitchName, type: "code" as const },
        { label: "Trigger", value: backupConfig.triggerName, type: "code" as const },
        { label: "Action", value: backupConfig.actionName, type: "code" as const },
      );
    } else {
      backupEvidence.push({
        label: "Verificação",
        value: "Nenhum automation-stitch de backup encontrado",
        type: "text" as const,
      });
    }

    checks.push({
      id: "bkp-001",
      name: "Backup Automático Configurado",
      description: "Verifica se backup automático de configuração está habilitado via automation stitch",
      category: "Backup e Recovery",
      status: backupStatus,
      severity: "high",
      recommendation: backupRecommendation,
      details: backupDetails,
      apiEndpoint: "/api/v2/cmdb/system/automation-stitch",
      evidence: backupEvidence,
      rawData: {
        ...backupConfig,
      },
    });
  } catch (error) {
    console.error("Error checking HA and backup:", error);
    checks.push({
      id: "ha-err",
      name: "Erro ao verificar HA/Backup",
      description: "Não foi possível verificar configurações de HA e backup",
      category: "Alta Disponibilidade",
      status: "pending",
      severity: "high",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      apiEndpoint: "/api/v2/cmdb/system/ha",
    });
  }

  return checks;
}

// Versões recomendadas pela Fortinet (atualizado em Dezembro 2025)
const FORTINET_RECOMMENDED_VERSIONS: Record<string, string> = {
  default: "7.4.8",
  "FortiGate-30E": "6.2.16",
  "FortiGate-50E": "6.2.16",
  "FortiGate-60E": "6.4.15",
  "FortiGate-80E": "6.4.15",
  "FortiGate-90E": "6.4.15",
  "FortiGate-100E": "6.4.15",
  "FortiGate-200E": "6.4.15",
  "FortiGate-100F": "7.4.8",
  "FortiGate-200F": "7.4.8",
  "FortiGate-400F": "7.4.8",
  "FortiGate-600F": "7.4.8",
};

// Extrair versão do FortiOS
function extractVersion(versionString: string): string {
  if (!versionString) return "";
  const match = versionString.match(/(\d+\.\d+\.?\d*)/);
  return match ? match[1] : "";
}

// Comparar versões
function compareVersions(current: string, recommended: string): "up-to-date" | "outdated" | "unknown" {
  if (!current || current === "Desconhecida") return "unknown";

  const currentParts = current.split(".").map(Number);
  const recommendedParts = recommended.split(".").map(Number);

  for (let i = 0; i < Math.max(currentParts.length, recommendedParts.length); i++) {
    const curr = currentParts[i] || 0;
    const rec = recommendedParts[i] || 0;

    if (curr > rec) return "up-to-date";
    if (curr < rec) return "outdated";
  }

  return "up-to-date";
}

// Verificar Firmware
async function checkFirmware(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];

  try {
    const systemStatus = await fortigateRequest(config, "/monitor/system/status");
    const globalSettings = await fortigateRequest(config, "/cmdb/system/global");

    const status = systemStatus.results || systemStatus || {};
    const global = globalSettings.results || {};

    const rootSerial = systemStatus.serial || "";
    const rootVersion = systemStatus.version || "";

    console.log("System status:", { serial: rootSerial, version: rootVersion });

    const rawVersion = status.version || status.current_version || status.fos_version || global.version || "";
    let currentVersion = extractVersion(rawVersion);

    if (!currentVersion) {
      try {
        const firmwareStatus = await fortigateRequest(config, "/monitor/system/firmware");
        const fw = firmwareStatus.results || firmwareStatus || {};
        if (fw.current && fw.current.version) {
          currentVersion = extractVersion(fw.current.version);
        }
      } catch {
        console.log("Could not fetch firmware status");
      }
    }

    currentVersion = currentVersion || "Desconhecida";

    let serial = rootSerial;
    if (!serial) {
      if (status.serial) serial = status.serial;
      else if (status.serial_number) serial = status.serial_number;
      else if (status["serial-number"]) serial = status["serial-number"];
      else if (status.sn) serial = status.sn;
      if (!serial && global.serial) serial = global.serial;
    }

    const hostname = status.hostname || global.hostname || "";
    const model = status.model_name || status.model || global.model || "";

    let uptimeStr = "";
    if (status.uptime !== undefined && status.uptime !== null) {
      if (typeof status.uptime === "number") {
        const days = Math.floor(status.uptime / 86400);
        const hours = Math.floor((status.uptime % 86400) / 3600);
        const minutes = Math.floor((status.uptime % 3600) / 60);
        uptimeStr = days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
      } else {
        uptimeStr = String(status.uptime);
      }
    }

    const recommendedVersion = FORTINET_RECOMMENDED_VERSIONS[model] || FORTINET_RECOMMENDED_VERSIONS["default"];
    const versionStatus = compareVersions(currentVersion, recommendedVersion);

    let checkStatus: "pass" | "fail" | "warning" = "pass";
    let recommendation = "Firmware está atualizado conforme recomendação Fortinet";
    let details = `Versão atual: FortiOS ${currentVersion} | Recomendada: ${recommendedVersion}`;

    if (versionStatus === "outdated") {
      checkStatus = "fail";
      recommendation = `Atualizar para FortiOS ${recommendedVersion} conforme recomendação Fortinet`;
      details = `Versão DESATUALIZADA: FortiOS ${currentVersion} → Recomendada: ${recommendedVersion}`;
    } else if (versionStatus === "unknown") {
      checkStatus = "warning";
      recommendation = "Não foi possível comparar versões. Verificar manualmente no suporte Fortinet";
      details = `Versão atual: ${rawVersion || "Não identificada"}`;
    }

    const evidence: EvidenceItem[] = [
      {
        label: "Versão FortiOS Atual",
        value: currentVersion || rawVersion || "Não identificada",
        type: "text" as const,
      },
      { label: "Versão Recomendada Fortinet", value: recommendedVersion, type: "text" as const },
      {
        label: "Status",
        value:
          versionStatus === "up-to-date"
            ? "✅ Atualizado"
            : versionStatus === "outdated"
              ? "❌ Desatualizado"
              : "⚠️ Verificar manualmente",
        type: "text" as const,
      },
      { label: "Modelo", value: model || "Não identificado", type: "text" as const },
      { label: "Hostname", value: hostname || "Não identificado", type: "text" as const },
      { label: "Serial Number", value: serial || "Não identificado", type: "code" as const },
    ];

    if (uptimeStr) evidence.push({ label: "Uptime", value: uptimeStr, type: "text" as const });

    checks.push({
      id: "upd-001",
      name: "Versão do Firmware",
      description: "Verifica se o firmware está na versão recomendada pela Fortinet",
      category: "Atualizações",
      status: checkStatus,
      severity: "high",
      details,
      recommendation,
      apiEndpoint: "/api/v2/monitor/system/status",
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
      },
    });
  } catch (error) {
    console.error("Error checking firmware:", error);
    checks.push({
      id: "upd-err",
      name: "Erro ao verificar firmware",
      description: "Não foi possível verificar a versão do firmware",
      category: "Atualizações",
      status: "pending",
      severity: "high",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      apiEndpoint: "/api/v2/monitor/system/status",
    });
  }

  return checks;
}

// Verificar Licenças
async function checkFortiGuardLicenses(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];

  try {
    const licenseStatus = await fortigateRequest(config, "/monitor/license/status");
    const licenses = licenseStatus.results || licenseStatus || {};

    // FortiCare Support
    const forticareInfo = licenses.forticare || {};
    const supportInfo = forticareInfo.support || {};
    const hardwareSupport = supportInfo.hardware || {};
    const enhancedSupport = supportInfo.enhanced || {};

    const hardwareExpiry = hardwareSupport.expires || 0;
    const enhancedExpiry = enhancedSupport.expires || 0;
    const supportExpiry = Math.max(hardwareExpiry, enhancedExpiry);
    const supportStatus = hardwareSupport.status || enhancedSupport.status || forticareInfo.status || "unknown";
    const registrationStatus = forticareInfo.registration_status || forticareInfo.status || "";

    let supportActive = false;
    let supportDaysRemaining = 0;
    let supportExpiryDate = "";

    if (supportExpiry) {
      const expiryDate = new Date(supportExpiry * 1000);
      supportExpiryDate = expiryDate.toLocaleDateString("pt-BR");
      supportDaysRemaining = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      supportActive = supportDaysRemaining > 0;
    } else if (
      supportStatus === "licensed" ||
      supportStatus === "valid" ||
      supportStatus === "active" ||
      registrationStatus === "registered"
    ) {
      supportActive = true;
    }

    let supportCheckStatus: "pass" | "fail" | "warning" = "pass";
    let supportDetails = "Suporte FortiCare ativo";
    let supportRecommendation = "Manter contrato de suporte ativo";

    if (!supportActive) {
      supportCheckStatus = "fail";
      supportDetails = "Suporte FortiCare EXPIRADO ou não identificado";
      supportRecommendation = "Renovar contrato FortiCare imediatamente";
    } else if (supportDaysRemaining > 0 && supportDaysRemaining <= 30) {
      supportCheckStatus = "warning";
      supportDetails = `Suporte FortiCare expira em ${supportDaysRemaining} dias (${supportExpiryDate})`;
      supportRecommendation = "Renovar contrato FortiCare antes da expiração";
    } else if (supportDaysRemaining > 30) {
      supportDetails = `Suporte FortiCare ativo até ${supportExpiryDate} (${supportDaysRemaining} dias restantes)`;
    }

    const supportEvidence: EvidenceItem[] = [
      { label: "Status", value: supportActive ? "✅ Ativo" : "❌ Expirado/Inativo", type: "text" as const },
    ];
    if (supportExpiryDate) {
      supportEvidence.push({ label: "Data de Expiração", value: supportExpiryDate, type: "text" as const });
      supportEvidence.push({
        label: "Dias Restantes",
        value: supportDaysRemaining > 0 ? String(supportDaysRemaining) : "Expirado",
        type: "text" as const,
      });
    }

    checks.push({
      id: "lic-001",
      name: "Suporte FortiCare",
      description: "Verifica se o contrato de suporte FortiCare está ativo",
      category: "Licenciamento",
      status: supportCheckStatus,
      severity: "critical",
      details: supportDetails,
      recommendation: supportRecommendation,
      apiEndpoint: "/api/v2/monitor/license/status",
      evidence: supportEvidence,
      rawData: { forticare: forticareInfo, daysRemaining: supportDaysRemaining },
    });

    // FortiGuard Services - Buscar em múltiplas chaves possíveis do JSON
    // IMPORTANTE: web_filtering é a chave correta para Web Filter no JSON da API
    console.log("[LICENSE] License keys available:", Object.keys(licenses));
    
    const securityServicesMap = [
      { key: "antivirus", altKeys: ["av", "fortigate_av", "fgt_av"], name: "Antivírus" },
      { key: "ips", altKeys: ["nids", "fortigate_ips", "fgt_ips"], name: "IPS" },
      { key: "web_filtering", altKeys: ["webfilter", "fgd_wf", "webfiltering", "fortiguard_webfilter", "fgt_wf"], name: "Web Filter" },
      { key: "appctrl", altKeys: ["app_ctrl", "application_control", "fortigate_appctrl"], name: "App Control" },
      { key: "antispam", altKeys: ["anti_spam", "fortigate_antispam", "fgt_antispam"], name: "AntiSpam" },
    ];

    const activeServices: string[] = [];
    const expiredServices: string[] = [];
    const expiringServices: string[] = [];
    const licenseEvidence: EvidenceItem[] = [];

    for (const serviceMapping of securityServicesMap) {
      let serviceInfo = licenses[serviceMapping.key];
      let foundKey = serviceMapping.key;
      
      if (!serviceInfo || (typeof serviceInfo === 'object' && Object.keys(serviceInfo).length === 0)) {
        for (const altKey of serviceMapping.altKeys) {
          const altInfo = licenses[altKey];
          if (altInfo && (typeof altInfo !== 'object' || Object.keys(altInfo).length > 0)) {
            serviceInfo = altInfo;
            foundKey = altKey;
            break;
          }
        }
      }
      
      console.log(`[LICENSE] ${serviceMapping.name}: key=${foundKey}, info=`, JSON.stringify(serviceInfo));
      
      // Se ainda não encontrou, pode ser que o valor seja direto (não objeto)
      if (!serviceInfo && licenses[serviceMapping.key] !== undefined) {
        serviceInfo = { status: licenses[serviceMapping.key] };
      }
      
      serviceInfo = serviceInfo || {};

      // Buscar status em múltiplos campos possíveis
      const status = serviceInfo.status || serviceInfo.entitlement || serviceInfo.license_status || "unknown";
      // Buscar expiração em múltiplos campos - alguns FortiOS usam campos diferentes
      const expiry = serviceInfo.expires || serviceInfo.expiry_date || serviceInfo.expire_time || serviceInfo.expiration || 0;
      const serviceName = serviceMapping.name;

      console.log(`[LICENSE] ${serviceName}: status=${status}, expiry=${expiry}`);

      let isActive = false;
      let daysRemaining = 0;
      let expiryDateStr = "";

      if (expiry) {
        // Verificar se expiry é timestamp (número) ou string ISO
        let expiryDate: Date;
        if (typeof expiry === 'string') {
          expiryDate = new Date(expiry);
        } else {
          expiryDate = new Date(expiry * 1000);
        }
        
        if (!isNaN(expiryDate.getTime())) {
          expiryDateStr = expiryDate.toLocaleDateString("pt-BR");
          daysRemaining = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          isActive = daysRemaining > 0;
          console.log(`[LICENSE] ${serviceName}: expiryDate=${expiryDateStr}, daysRemaining=${daysRemaining}`);
        }
      }
      
      // Verificar status se não conseguiu pela data
      if (!isActive && !expiry) {
        const activeStatuses = ["licensed", "valid", "active", "enabled", "enable", "registered", "1"];
        isActive = activeStatuses.includes(String(status).toLowerCase());
        console.log(`[LICENSE] ${serviceName}: checking status '${status}', isActive=${isActive}`);
      }

      if (isActive) {
        if (daysRemaining > 0 && daysRemaining <= 30) {
          expiringServices.push(serviceName);
          licenseEvidence.push({
            label: serviceName,
            value: `⚠️ Expira em ${daysRemaining} dias`,
            type: "text" as const,
          });
        } else {
          activeServices.push(serviceName);
          licenseEvidence.push({
            label: serviceName,
            value: expiryDateStr ? `✅ Ativo até ${expiryDateStr}` : "✅ Ativo",
            type: "text" as const,
          });
        }
      } else {
        expiredServices.push(serviceName);
        licenseEvidence.push({ label: serviceName, value: "❌ Expirado/Inativo", type: "text" as const });
      }
    }

    let licenseCheckStatus: "pass" | "fail" | "warning" = "pass";
    let licenseDetails = `${activeServices.length + expiringServices.length} de ${securityServicesMap.length} serviços FortiGuard ativos`;
    let licenseRecommendation = "Manter todas as licenças FortiGuard atualizadas";

    if (expiredServices.length > 0) {
      licenseCheckStatus = "fail";
      licenseDetails = `${expiredServices.length} serviços FortiGuard expirados: ${expiredServices.join(", ")}`;
      licenseRecommendation = "Renovar licenças FortiGuard expiradas";
    } else if (expiringServices.length > 0) {
      licenseCheckStatus = "warning";
      licenseDetails = `${expiringServices.length} serviços expirando: ${expiringServices.join(", ")}`;
      licenseRecommendation = "Renovar licenças FortiGuard antes da expiração";
    }

    checks.push({
      id: "lic-002",
      name: "Licenças FortiGuard",
      description: "Verifica status das licenças de segurança FortiGuard",
      category: "Licenciamento",
      status: licenseCheckStatus,
      severity: "high",
      details: licenseDetails,
      recommendation: licenseRecommendation,
      apiEndpoint: "/api/v2/monitor/license/status",
      evidence: licenseEvidence,
      rawData: { active: activeServices, expired: expiredServices, expiring: expiringServices },
    });
  } catch (error) {
    console.error("Error checking licenses:", error);
    checks.push({
      id: "lic-err",
      name: "Erro ao verificar licenças",
      description: "Não foi possível verificar o status das licenças",
      category: "Licenciamento",
      status: "pending",
      severity: "high",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      apiEndpoint: "/api/v2/monitor/license/status",
    });
  }

  return checks;
}

// Verificar VPN
async function checkVPN(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];

  try {
    const vpnIpsec = await fortigateRequest(config, "/cmdb/vpn.ipsec/phase1-interface");
    const vpnPhase1 = vpnIpsec.results || [];

    const weakEncryption: { name: string; proposal: string }[] = [];
    const strongEncryption: { name: string; proposal: string }[] = [];

    const weakAlgorithms = ["des", "3des", "md5", "sha1"];

    for (const vpn of vpnPhase1) {
      const proposals = vpn.proposal || "";
      const isWeak = weakAlgorithms.some((alg) => proposals.toLowerCase().includes(alg));

      if (isWeak) {
        weakEncryption.push({ name: vpn.name, proposal: proposals });
      } else {
        strongEncryption.push({ name: vpn.name, proposal: proposals });
      }
    }

    if (vpnPhase1.length > 0) {
      checks.push({
        id: "vpn-001",
        name: "Criptografia IPsec VPN",
        description: "Verifica força dos algoritmos de criptografia das VPNs",
        category: "Configuração VPN",
        status: weakEncryption.length > 0 ? "warning" : "pass",
        severity: "high",
        recommendation:
          weakEncryption.length > 0
            ? "Atualizar VPNs para usar algoritmos mais fortes (AES-256, SHA-256)"
            : "Manter configuração atual",
        details:
          weakEncryption.length > 0
            ? `${weakEncryption.length} VPN(s) com criptografia fraca`
            : `${vpnPhase1.length} VPN(s) com criptografia forte`,
        apiEndpoint: "/api/v2/cmdb/vpn.ipsec/phase1-interface",
        evidence:
          weakEncryption.length > 0
            ? weakEncryption.map((v) => ({
                label: `VPN: ${v.name}`,
                value: `proposal: ${v.proposal}`,
                type: "code" as const,
              }))
            : strongEncryption.slice(0, 5).map((v) => ({
                label: `VPN: ${v.name}`,
                value: `proposal: ${v.proposal}`,
                type: "code" as const,
              })),
        rawData: { weak: weakEncryption, strong: strongEncryption, total: vpnPhase1.length },
      });
    }

    // SSL VPN
    try {
      const sslSettings = await fortigateRequest(config, "/cmdb/vpn.ssl/settings");
      const ssl = sslSettings.results || {};

      const sslvpnEnabled = ssl.status === "enable" || ssl["login-port"] > 0;
      const servercert = ssl.servercert || "Fortinet_Factory";
      const isFactoryCert =
        servercert.toLowerCase().includes("factory") || servercert.toLowerCase().includes("self-signed");

      if (sslvpnEnabled) {
        checks.push({
          id: "vpn-003",
          name: "Certificado SSL VPN",
          description: "Verifica se SSL VPN usa certificado válido",
          category: "Configuração VPN",
          status: isFactoryCert ? "warning" : "pass",
          severity: "medium",
          recommendation: isFactoryCert
            ? "Substituir certificado de fábrica por certificado de CA confiável"
            : "Manter configuração atual",
          details: `Certificado: ${servercert}`,
          apiEndpoint: "/api/v2/cmdb/vpn.ssl/settings",
          evidence: [
            { label: "Certificado", value: servercert, type: "code" as const },
            { label: "Porta", value: String(ssl["login-port"] || 443), type: "text" as const },
          ],
          rawData: { servercert, loginPort: ssl["login-port"] },
        });
      }
    } catch {
      // SSL VPN não configurado
    }
  } catch (error) {
    console.error("Error checking VPN:", error);
    checks.push({
      id: "vpn-err",
      name: "Erro ao verificar VPN",
      description: "Não foi possível verificar configurações de VPN",
      category: "Configuração VPN",
      status: "pending",
      severity: "high",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      apiEndpoint: "/api/v2/cmdb/vpn.ipsec/phase1-interface",
    });
  }

  return checks;
}

// Verificar Logging
async function checkLogging(config: FortiGateConfig): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];

  try {
    const logSettings = await fortigateRequest(config, "/cmdb/log/setting");
    const settings = logSettings.results || {};

    const logInvalidPacket = settings["log-invalid-packet"] || "disable";
    const resolveIp = settings["resolve-ip"] || "disable";
    const logEnabled = logInvalidPacket === "enable" || resolveIp === "enable";

    checks.push({
      id: "log-001",
      name: "Log de Eventos",
      description: "Verifica se logging está habilitado para eventos críticos",
      category: "Logging e Monitoramento",
      status: logEnabled ? "pass" : "warning",
      severity: "high",
      recommendation: !logEnabled ? "Habilitar logging para eventos de segurança" : "Manter configuração atual",
      apiEndpoint: "/api/v2/cmdb/log/setting",
      evidence: [
        { label: "log-invalid-packet", value: logInvalidPacket, type: "code" as const },
        { label: "resolve-ip", value: resolveIp, type: "code" as const },
      ],
      rawData: { logInvalidPacket, resolveIp },
    });

    // FortiAnalyzer
    let fortiAnalyzerEnabled = false;
    let fortiAnalyzerServer = "N/A";

    try {
      const fazSettings = await fortigateRequest(config, "/cmdb/log.fortianalyzer/setting");
      const faz = fazSettings.results || {};
      fortiAnalyzerEnabled = faz.status === "enable";
      fortiAnalyzerServer = faz.server || "N/A";
    } catch {}

    // FortiCloud
    let fortiCloudEnabled = false;

    try {
      const cloudSettings = await fortigateRequest(config, "/cmdb/log.fortiguard/setting");
      const cloud = cloudSettings.results || {};
      fortiCloudEnabled = cloud.status === "enable";
    } catch {}

    const logForwardingEnabled = fortiAnalyzerEnabled || fortiCloudEnabled;

    checks.push({
      id: "log-002",
      name: "Envio de Logs para FortiAnalyzer/FortiCloud",
      description: "Verifica se logs são enviados para FortiAnalyzer ou FortiCloud",
      category: "Logging e Monitoramento",
      status: logForwardingEnabled ? "pass" : "warning",
      severity: "medium",
      recommendation: logForwardingEnabled
        ? "Manter configuração atual"
        : "Configurar envio de logs para FortiAnalyzer ou FortiCloud",
      details: fortiAnalyzerEnabled
        ? `FortiAnalyzer: ${fortiAnalyzerServer}`
        : fortiCloudEnabled
          ? "FortiCloud habilitado"
          : "Nenhum sistema de centralização de logs configurado",
      apiEndpoint: "/api/v2/cmdb/log.fortianalyzer/setting",
      evidence: [
        {
          label: "FortiAnalyzer",
          value: fortiAnalyzerEnabled ? `✅ ${fortiAnalyzerServer}` : "❌ Não configurado",
          type: "text" as const,
        },
        {
          label: "FortiCloud",
          value: fortiCloudEnabled ? "✅ Habilitado" : "❌ Não configurado",
          type: "text" as const,
        },
      ],
      rawData: { fortiAnalyzerEnabled, fortiAnalyzerServer, fortiCloudEnabled },
    });
  } catch (error) {
    console.error("Error checking logging:", error);
    checks.push({
      id: "log-err",
      name: "Erro ao verificar logging",
      description: "Não foi possível verificar configurações de log",
      category: "Logging e Monitoramento",
      status: "pending",
      severity: "medium",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      apiEndpoint: "/api/v2/cmdb/log/setting",
    });
  }

  return checks;
}

// ==================== SUMÁRIO DE RECOMENDAÇÕES ====================
function generateRecommendations(
  interfaceClassifications: InterfaceClassification[],
  policies: any[],
  inboundWithoutIPS: InboundWANPolicy[],
): ComplianceCheck {
  const recommendations: string[] = [];
  const evidence: EvidenceItem[] = [];

  // Interfaces com role undefined
  const undefinedInterfaces = interfaceClassifications.filter((c) => c.role === "undefined");
  if (undefinedInterfaces.length > 0) {
    recommendations.push("Definir corretamente o role das interfaces (LAN/WAN/DMZ) atualmente como undefined");
    evidence.push({
      label: "Interfaces com role undefined",
      value: undefinedInterfaces.map((i) => i.name).join(", "),
      type: "code" as const,
    });
  }

  // Interfaces sem policy
  const allPolicySrcIntf = new Set<string>();
  const allPolicyDstIntf = new Set<string>();
  for (const policy of policies) {
    for (const src of policy.srcintf || []) {
      allPolicySrcIntf.add(src.name);
    }
    for (const dst of policy.dstintf || []) {
      allPolicyDstIntf.add(dst.name);
    }
  }

  const interfacesWithoutPolicy = interfaceClassifications.filter(
    (iface) => !allPolicySrcIntf.has(iface.name) && !allPolicyDstIntf.has(iface.name),
  );

  // Filtrar apenas interfaces relevantes (não loopback, não tunnel, etc.)
  const relevantWithoutPolicy = interfacesWithoutPolicy.filter(
    (iface) => !iface.name.includes("lo") && !iface.name.includes("npu") && !iface.name.includes("ssl."),
  );

  if (relevantWithoutPolicy.length > 0) {
    recommendations.push("Criar ou revisar firewall policies para interfaces sem regras definidas");
    evidence.push({
      label: "Interfaces sem policies",
      value: relevantWithoutPolicy.map((i) => i.name).join(", "),
      type: "code" as const,
    });
  }

  // Inbound WAN sem IPS
  if (inboundWithoutIPS.length > 0) {
    recommendations.push("Aplicar IPS/IDS nas policies inbound WAN sem proteção");
    evidence.push({
      label: "Policies inbound WAN sem IPS",
      value: inboundWithoutIPS.map((p) => `#${p.policyid}: ${p.name}`).join(", "),
      type: "code" as const,
    });
  }

  const hasIssues = recommendations.length > 0;

  return {
    id: "rec-001",
    name: "Sumário de Recomendações",
    description: "Consolidação de recomendações baseadas na análise de conformidade",
    category: "Recomendações",
    status: hasIssues ? "warning" : "pass",
    severity: "medium",
    recommendation: recommendations.length > 0 ? recommendations.join(" | ") : "Nenhuma recomendação adicional",
    details: hasIssues ? `${recommendations.length} recomendação(ões) identificada(s)` : "Configuração em conformidade",
    apiEndpoint: "Análise agregada",
    evidence:
      evidence.length > 0
        ? evidence
        : [
            {
              label: "Status",
              value: "✅ Sem recomendações pendentes",
              type: "text" as const,
            },
          ],
    rawData: {
      undefinedInterfaces: undefinedInterfaces.map((i) => i.name),
      interfacesWithoutPolicy: relevantWithoutPolicy.map((i) => i.name),
      inboundWithoutIPS: inboundWithoutIPS.map((p) => ({ id: p.policyid, name: p.name })),
    },
  };
}

// Teste de conectividade
async function testFortiGateConnection(config: FortiGateConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${config.url}/api/v2/monitor/system/status`;
    console.log(`Testing connection to: ${url}`);

    const response = await fetchWithoutSSLVerification(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: "API Key inválida ou sem permissões" };
      }
      if (response.status === 404) {
        return { success: false, error: "Endpoint FortiGate não encontrado" };
      }
      return { success: false, error: `Erro ${response.status}: ${text.substring(0, 100)}` };
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return { success: false, error: "Resposta inválida. O endereço não parece ser uma API FortiGate." };
    }

    const data = await response.json();
    if (!data.results && !data.version) {
      return { success: false, error: "Resposta não reconhecida como FortiGate" };
    }

    return { success: true };
  } catch (error) {
    console.error("Connection test error:", error);
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return { success: false, error: "Não foi possível conectar. Verifique se a URL está acessível." };
    }
    return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" };
  }
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    "Políticas de Segurança": "shield",
    "Segurança de Interfaces": "monitor",
    "Configuração de Rede": "network",
    "Regras de Entrada": "arrowDownToLine",
    "Perfis de Segurança UTM": "shieldCheck",
    "Alta Disponibilidade": "serverCog",
    "Backup e Recovery": "hardDrive",
    "Configuração VPN": "lock",
    "Logging e Monitoramento": "activity",
    Licenciamento: "award",
    Atualizações: "download",
    Recomendações: "lightbulb",
  };
  return icons[category] || "check";
}

// ==================== HANDLER PRINCIPAL ====================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, apiKey } = await req.json();

    if (!url || !apiKey) {
      return new Response(JSON.stringify({ error: "URL e API Key são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = "https://" + normalizedUrl;
    }
    normalizedUrl = normalizedUrl.replace(/\/$/, "");

    const config: FortiGateConfig = { url: normalizedUrl, apiKey: apiKey.trim() };

    console.log(`Starting compliance check for: ${config.url}`);

    // Testar conectividade
    const connectionTest = await testFortiGateConnection(config);
    if (!connectionTest.success) {
      return new Response(JSON.stringify({ error: "Falha na conexão com FortiGate", details: connectionTest.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PRIMEIRO: Classificar interfaces
    const { classifications, wanInterfaceNames, sdwanMembers } = await classifyInterfaces(config);

    // Buscar policies para análises
    const policiesResponse = await fortigateRequest(config, "/cmdb/firewall/policy").catch(() => ({ results: [] }));
    const allPolicies = policiesResponse.results || [];

    // Identificar inbound WAN policies
    const inboundWANPolicies = identifyInboundWANPolicies(allPolicies, wanInterfaceNames);
    const inboundWithoutIPS = inboundWANPolicies.filter((p) => !p.hasIPS);

    // Executar verificações em paralelo
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
      checkUTMProfiles(config, wanInterfaceNames),
      checkHAAndBackup(config),
      checkFirmware(config),
      checkVPN(config),
      checkLogging(config),
      checkFortiGuardLicenses(config),
    ]);

    // Gerar sumário de recomendações
    const recommendationsCheck = generateRecommendations(classifications, allPolicies, inboundWithoutIPS);

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
      recommendationsCheck,
    ];

    const passed = allChecks.filter((c) => c.status === "pass").length;
    const failed = allChecks.filter((c) => c.status === "fail").length;
    const warnings = allChecks.filter((c) => c.status === "warning").length;

    const categories = [
      "Políticas de Segurança",
      "Segurança de Interfaces",
      "Configuração de Rede",
      "Regras de Entrada",
      "Perfis de Segurança UTM",
      "Alta Disponibilidade",
      "Backup e Recovery",
      "Configuração VPN",
      "Logging e Monitoramento",
      "Licenciamento",
      "Atualizações",
      "Recomendações",
    ];

    const categoryData = categories
      .map((cat) => {
        const catChecks = allChecks.filter((c) => c.category === cat);
        const catPassed = catChecks.filter((c) => c.status === "pass").length;
        return {
          name: cat,
          icon: getCategoryIcon(cat),
          checks: catChecks,
          passRate: catChecks.length > 0 ? Math.round((catPassed / catChecks.length) * 100) : 100,
        };
      })
      .filter((cat) => cat.checks.length > 0);

    // Calcular score (excluir categoria Recomendações do cálculo - são apenas sugestões)
    const weights: Record<string, number> = { critical: 5, high: 3, medium: 1, low: 0 };
    let failedPoints = 0;

    // Filtrar apenas checks que NÃO são da categoria Recomendações
    const scoringChecks = allChecks.filter((c) => c.category !== "Recomendações");

    for (const check of scoringChecks) {
      if (check.status === "fail" || check.status === "warning") {
        failedPoints += weights[check.severity] || 0;
      }
    }

    const calculatedScore = Math.max(0, 100 - failedPoints);

    const firmwareCheck = allChecks.find((c) => c.id === "upd-001");
    const firmwareVersion = (firmwareCheck?.rawData?.version as string) || "";
    const serialNumber = (firmwareCheck?.rawData?.serial as string) || "";
    const hostname = (firmwareCheck?.rawData?.hostname as string) || "";
    const model = (firmwareCheck?.rawData?.model as string) || "";

    const report = {
      overallScore: calculatedScore,
      totalChecks: allChecks.length,
      passed,
      failed,
      warnings,
      categories: categoryData,
      generatedAt: new Date().toISOString(),
      firmwareVersion,
      serialNumber,
      hostname,
      model,
      interfaceClassifications: classifications,
      inboundWANPolicies: inboundWANPolicies.map((p) => ({
        policyid: p.policyid,
        name: p.name,
        srcintf: p.srcintf,
        dstintf: p.dstintf,
        hasIPS: p.hasIPS,
      })),
    };

    console.log(`Compliance check completed: ${passed}/${allChecks.length} passed, score: ${calculatedScore}`);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in fortigate-compliance function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro ao conectar com FortiGate",
        details: "Verifique a URL e a API Key fornecidas",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
