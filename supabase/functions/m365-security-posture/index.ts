/**
 * M365 Security Posture - Edge Function Modular
 * 
 * Arquitetura:
 * - Collectors paralelos por categoria de risco
 * - Cada collector é independente e falha parcial não quebra tudo
 * - Score consolidado com algoritmo escalável
 * - Cache por tenant (futuro)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// CORS & TYPES
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type M365RiskCategory = 
  | 'identities'
  | 'auth_access'
  | 'admin_privileges'
  | 'apps_integrations'
  | 'email_exchange'
  | 'threats_activity';

type M365Product = 
  | 'entra_id' 
  | 'exchange_online' 
  | 'sharepoint' 
  | 'defender' 
  | 'intune';

type M365Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type M365InsightStatus = 'pass' | 'fail' | 'warning';
type InsightSource = 'graph' | 'exchange_powershell' | 'mixed';

interface RemediationGuide {
  productAfetado: M365Product;
  portalUrl: string;
  caminhoPortal: string[];
  comandoPowerShell?: string;
  passosDetalhados: string[];
  referenciaDocumentacao: string;
}

interface AffectedEntity {
  id: string;
  displayName: string;
  userPrincipalName?: string;
  email?: string;
  details?: Record<string, unknown>;
}

interface M365Insight {
  id: string;
  code: string;
  category: M365RiskCategory;
  product: M365Product;
  severity: M365Severity;
  titulo: string;
  descricaoExecutiva: string;
  riscoTecnico: string;
  impactoNegocio: string;
  scoreImpacto: number;
  status: M365InsightStatus;
  evidencias: unknown[];
  affectedEntities: AffectedEntity[];
  affectedCount: number;
  endpointUsado: string;
  source: InsightSource;
  remediacao: RemediationGuide;
  detectedAt: string;
  timeRange?: { from: string; to: string };
}

interface CollectorResult {
  category: M365RiskCategory;
  insights: M365Insight[];
  error?: string;
}

interface CollectorContext {
  accessToken: string;
  tenantId: string;
  dateFrom: string;
  dateTo: string;
}

// ============================================================
// ENCRYPTION UTILITIES
// ============================================================

function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get('M365_ENCRYPTION_KEY');
  if (!keyHex) {
    throw new Error('M365_ENCRYPTION_KEY não está configurada');
  }
  
  const keyBytes = fromHex(keyHex);
  return await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

async function decryptSecret(encrypted: string): Promise<string> {
  if (!encrypted.includes(':')) {
    try {
      return atob(encrypted);
    } catch {
      return encrypted;
    }
  }
  
  try {
    const [ivHex, ciphertextHex] = encrypted.split(':');
    const iv = fromHex(ivHex);
    const ciphertext = fromHex(ciphertextHex);
    const key = await getEncryptionKey();
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Falha ao decriptar secret');
  }
}

async function getAccessToken(tenantId: string, appId: string, clientSecret: string): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token request failed:', errorText);
    throw new Error(`Falha ao obter access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ============================================================
// GRAPH API HELPERS
// ============================================================

async function graphGet(accessToken: string, endpoint: string): Promise<any> {
  const url = endpoint.startsWith('https://') 
    ? endpoint 
    : `https://graph.microsoft.com/v1.0${endpoint}`;
    
  const response = await fetch(url, {
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'ConsistencyLevel': 'eventual',
    },
  });
  
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('PERMISSION_DENIED');
    }
    throw new Error(`Graph API error: ${response.status}`);
  }
  
  return response.json();
}

async function graphGetAll(accessToken: string, endpoint: string, maxItems = 500): Promise<any[]> {
  const items: any[] = [];
  let nextLink: string | null = endpoint.startsWith('https://') 
    ? endpoint 
    : `https://graph.microsoft.com/v1.0${endpoint}`;
  
  while (nextLink && items.length < maxItems) {
    const response = await fetch(nextLink, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'ConsistencyLevel': 'eventual',
      },
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        console.warn(`Permission denied for ${endpoint}`);
        return items;
      }
      break;
    }
    
    const data = await response.json();
    items.push(...(data.value || []));
    nextLink = data['@odata.nextLink'] || null;
  }
  
  return items;
}

// ============================================================
// SCORE CALCULATION
// ============================================================

const SEVERITY_WEIGHTS: Record<M365Severity, number> = {
  critical: 15,
  high: 8,
  medium: 4,
  low: 2,
  info: 0,
};

function calculateInsightPenalty(insight: M365Insight): number {
  const severityWeight = SEVERITY_WEIGHTS[insight.severity];
  const impactScale = Math.log10(insight.affectedCount + 1) + 1;
  return severityWeight * (insight.scoreImpacto / 5) * impactScale;
}

function calculatePostureScore(insights: M365Insight[]): number {
  const failedInsights = insights.filter(i => i.status === 'fail');
  const totalPenalty = failedInsights.reduce(
    (sum, insight) => sum + calculateInsightPenalty(insight),
    0
  );
  return Math.max(0, Math.round(100 - totalPenalty));
}

function getClassification(score: number): 'excellent' | 'good' | 'attention' | 'critical' {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'attention';
  return 'critical';
}

// ============================================================
// COLLECTOR: IDENTITIES
// ============================================================

async function collectIdentityInsights(ctx: CollectorContext): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const now = new Date().toISOString();
  
  try {
    console.log('[IDENTITIES] Starting collection...');
    
    // Fetch MFA registration status
    const mfaStatus = await graphGetAll(ctx.accessToken, '/reports/authenticationMethods/userRegistrationDetails?$top=999');
    
    // IDT-001: Users without MFA
    const usersWithoutMfa = mfaStatus.filter((user: any) => {
      const methods = user.methodsRegistered || [];
      const hasStrongMfa = methods.some((m: string) => 
        ['microsoftAuthenticatorPush', 'softwareOneTimePasscode', 'hardwareOneTimePasscode', 'windowsHelloForBusiness'].includes(m)
      );
      return !hasStrongMfa && user.userType !== 'Guest';
    });
    
    if (usersWithoutMfa.length > 0) {
      insights.push({
        id: 'IDT-001',
        code: 'IDT-001',
        category: 'identities',
        product: 'entra_id',
        severity: 'high',
        titulo: 'Usuários sem MFA configurado',
        descricaoExecutiva: `${usersWithoutMfa.length} usuário(s) não possuem autenticação multifator (MFA) configurada. Essas contas estão vulneráveis a comprometimento de credenciais.`,
        riscoTecnico: 'Contas sem MFA podem ser comprometidas através de phishing, vazamento de senhas ou ataques de força bruta.',
        impactoNegocio: 'Um atacante pode acessar dados corporativos, e-mails e sistemas internos usando credenciais roubadas.',
        scoreImpacto: 7,
        status: 'fail',
        evidencias: usersWithoutMfa.slice(0, 100),
        affectedEntities: usersWithoutMfa.slice(0, 50).map((user: any) => ({
          id: user.id,
          displayName: user.userDisplayName || 'Desconhecido',
          userPrincipalName: user.userPrincipalName || '',
          details: { registeredMethods: user.methodsRegistered || [] },
        })),
        affectedCount: usersWithoutMfa.length,
        endpointUsado: '/reports/authenticationMethods/userRegistrationDetails',
        source: 'graph',
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Protection', 'Authentication methods', 'Policies'],
          passosDetalhados: [
            'Acesse o portal Entra ID',
            'Navegue até Protection > Authentication methods',
            'Habilite métodos de MFA como Microsoft Authenticator',
            'Crie uma política de Acesso Condicional exigindo MFA',
            'Comunique os usuários sobre a obrigatoriedade',
          ],
          referenciaDocumentacao: 'https://learn.microsoft.com/en-us/entra/identity/authentication/howto-mfa-getstarted',
        },
        detectedAt: now,
      });
    }
    
    console.log(`[IDENTITIES] Collected ${insights.length} insights`);
    
  } catch (error) {
    console.error('[IDENTITIES] Error:', error);
    return { category: 'identities', insights, error: String(error) };
  }
  
  return { category: 'identities', insights };
}

// ============================================================
// COLLECTOR: ADMIN PRIVILEGES
// ============================================================

async function collectAdminPrivilegesInsights(ctx: CollectorContext): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const now = new Date().toISOString();
  
  try {
    console.log('[ADMIN_PRIVILEGES] Starting collection...');
    
    // Fetch directory roles with members
    const roles = await graphGetAll(ctx.accessToken, '/directoryRoles?$expand=members');
    const mfaStatus = await graphGetAll(ctx.accessToken, '/reports/authenticationMethods/userRegistrationDetails?$top=999');
    
    const privilegedRoles = ['Global Administrator', 'Privileged Role Administrator', 'Security Administrator', 
      'Exchange Administrator', 'SharePoint Administrator', 'User Administrator'];
    
    // ADM-001: Too many Global Admins
    const globalAdminRole = roles.find((r: any) => r.displayName === 'Global Administrator');
    const globalAdmins = globalAdminRole?.members?.filter((m: any) => m['@odata.type'] === '#microsoft.graph.user') || [];
    
    if (globalAdmins.length > 5) {
      insights.push({
        id: 'ADM-001',
        code: 'ADM-001',
        category: 'admin_privileges',
        product: 'entra_id',
        severity: 'high',
        titulo: 'Excesso de Global Administrators',
        descricaoExecutiva: `O tenant possui ${globalAdmins.length} Global Administrators. Microsoft recomenda manter no máximo 5 contas com esse privilégio.`,
        riscoTecnico: 'Cada Global Admin tem acesso irrestrito ao tenant. Quanto mais contas com esse privilégio, maior a superfície de ataque.',
        impactoNegocio: 'Comprometimento de qualquer Global Admin pode resultar em controle total do ambiente Microsoft 365.',
        scoreImpacto: 8,
        status: 'fail',
        evidencias: globalAdmins,
        affectedEntities: globalAdmins.map((m: any) => ({
          id: m.id,
          displayName: m.displayName || 'Desconhecido',
          userPrincipalName: m.userPrincipalName || '',
        })),
        affectedCount: globalAdmins.length,
        endpointUsado: '/directoryRoles?$expand=members',
        source: 'graph',
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Identity', 'Roles & admins', 'Global Administrator'],
          passosDetalhados: [
            'Revise todos os Global Administrators atuais',
            'Identifique quais realmente precisam desse nível de acesso',
            'Rebaixe para roles mais específicas quando possível',
            'Mantenha 2-4 Global Admins como break-glass',
            'Implemente PIM para ativação just-in-time',
          ],
          referenciaDocumentacao: 'https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/best-practices',
        },
        detectedAt: now,
      });
    }
    
    // ADM-002: Privileged accounts without MFA
    const privilegedUserIds = new Set<string>();
    roles.forEach((role: any) => {
      if (privilegedRoles.some(pr => role.displayName?.includes(pr))) {
        (role.members || []).forEach((member: any) => {
          if (member['@odata.type'] === '#microsoft.graph.user') {
            privilegedUserIds.add(member.id);
          }
        });
      }
    });
    
    const privilegedWithoutMfa = mfaStatus.filter((user: any) => {
      if (!privilegedUserIds.has(user.id)) return false;
      const methods = user.methodsRegistered || [];
      const hasStrongMfa = methods.some((m: string) => 
        ['microsoftAuthenticatorPush', 'softwareOneTimePasscode', 'hardwareOneTimePasscode', 'windowsHelloForBusiness'].includes(m)
      );
      return !hasStrongMfa;
    });
    
    if (privilegedWithoutMfa.length > 0) {
      insights.push({
        id: 'ADM-002',
        code: 'ADM-002',
        category: 'admin_privileges',
        product: 'entra_id',
        severity: 'critical',
        titulo: 'Contas privilegiadas sem MFA',
        descricaoExecutiva: `${privilegedWithoutMfa.length} conta(s) com privilégios administrativos não possuem MFA configurado. Isso representa um risco crítico de segurança.`,
        riscoTecnico: 'Contas administrativas são alvos primários de ataques. Sem MFA, basta comprometer a senha para obter acesso total.',
        impactoNegocio: 'Comprometimento de conta administrativa pode resultar em vazamento de dados, interrupção de serviços e danos à reputação.',
        scoreImpacto: 10,
        status: 'fail',
        evidencias: privilegedWithoutMfa,
        affectedEntities: privilegedWithoutMfa.map((user: any) => ({
          id: user.id,
          displayName: user.userDisplayName || 'Desconhecido',
          userPrincipalName: user.userPrincipalName || '',
          details: { registeredMethods: user.methodsRegistered || [] },
        })),
        affectedCount: privilegedWithoutMfa.length,
        endpointUsado: '/directoryRoles + /reports/authenticationMethods/userRegistrationDetails',
        source: 'graph',
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Protection', 'Conditional Access', '+ New policy'],
          comandoPowerShell: 'Connect-MgGraph -Scopes "Policy.ReadWrite.ConditionalAccess"\n# Criar política exigindo MFA para roles administrativas',
          passosDetalhados: [
            'AÇÃO IMEDIATA: Exija MFA para todas as contas privilegiadas',
            'Crie política de Acesso Condicional direcionada a Directory Roles',
            'Selecione todos os roles administrativos',
            'Em Grant, selecione "Require multifactor authentication"',
            'Considere bloquear acesso até habilitação do MFA',
          ],
          referenciaDocumentacao: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-policy-admin-mfa',
        },
        detectedAt: now,
      });
    }
    
    console.log(`[ADMIN_PRIVILEGES] Collected ${insights.length} insights`);
    
  } catch (error) {
    console.error('[ADMIN_PRIVILEGES] Error:', error);
    return { category: 'admin_privileges', insights, error: String(error) };
  }
  
  return { category: 'admin_privileges', insights };
}

// ============================================================
// COLLECTOR: APPLICATIONS & INTEGRATIONS
// ============================================================

const CRITICAL_PERMISSIONS = [
  'Directory.ReadWrite.All',
  'Application.ReadWrite.All',
  'RoleManagement.ReadWrite.Directory',
  'AppRoleAssignment.ReadWrite.All',
  'Group.ReadWrite.All',
  'User.ReadWrite.All',
  'Mail.ReadWrite',
  'Mail.Send',
  'Files.ReadWrite.All',
];

async function collectAppsInsights(ctx: CollectorContext): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const now = new Date().toISOString();
  
  try {
    console.log('[APPS] Starting collection...');
    
    // Fetch applications
    const applications = await graphGetAll(ctx.accessToken, '/applications?$select=id,appId,displayName,passwordCredentials,keyCredentials,createdDateTime&$top=999');
    const servicePrincipals = await graphGetAll(ctx.accessToken, '/servicePrincipals?$select=id,appId,displayName,servicePrincipalType&$top=999');
    
    const nowDate = new Date();
    const thirtyDaysFromNow = new Date(nowDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // APP-001: Expired credentials
    const expiredApps: any[] = [];
    const expiringApps: any[] = [];
    
    applications.forEach((app: any) => {
      const credentials = [
        ...(app.passwordCredentials || []).map((c: any) => ({ ...c, type: 'Secret' })),
        ...(app.keyCredentials || []).map((c: any) => ({ ...c, type: 'Certificate' })),
      ];
      
      credentials.forEach((cred: any) => {
        if (cred.endDateTime) {
          const expireDate = new Date(cred.endDateTime);
          if (expireDate < nowDate) {
            expiredApps.push({ app, cred, expireDate });
          } else if (expireDate <= thirtyDaysFromNow) {
            expiringApps.push({ app, cred, expireDate });
          }
        }
      });
    });
    
    if (expiredApps.length > 0) {
      insights.push({
        id: 'APP-001',
        code: 'APP-001',
        category: 'apps_integrations',
        product: 'entra_id',
        severity: 'critical',
        titulo: 'Credenciais vencidas',
        descricaoExecutiva: `${expiredApps.length} aplicativo(s) possuem credenciais (secrets ou certificados) que já expiraram. Essas credenciais não funcionam mais.`,
        riscoTecnico: 'Credenciais expiradas causam falhas em integrações e podem indicar aplicações abandonadas.',
        impactoNegocio: 'Integrações quebradas afetam automações, sincronizações e processos de negócio dependentes.',
        scoreImpacto: 6,
        status: 'fail',
        evidencias: expiredApps.slice(0, 50),
        affectedEntities: expiredApps.slice(0, 50).map((item: any) => ({
          id: item.app.id,
          displayName: item.app.displayName,
          details: { 
            credentialType: item.cred.type,
            expiresAt: item.cred.endDateTime,
          },
        })),
        affectedCount: expiredApps.length,
        endpointUsado: '/applications',
        source: 'graph',
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Applications', 'App registrations', '[App]', 'Certificates & secrets'],
          passosDetalhados: [
            'Acesse o App Registration afetado',
            'Vá até Certificates & secrets',
            'Gere uma nova credencial',
            'Atualize a integração que usa essa credencial',
            'Remova a credencial expirada',
          ],
          referenciaDocumentacao: 'https://learn.microsoft.com/en-us/entra/identity-platform/howto-create-service-principal-portal',
        },
        detectedAt: now,
      });
    }
    
    if (expiringApps.length > 0) {
      insights.push({
        id: 'APP-002',
        code: 'APP-002',
        category: 'apps_integrations',
        product: 'entra_id',
        severity: 'high',
        titulo: 'Credenciais a vencer em 30 dias',
        descricaoExecutiva: `${expiringApps.length} aplicativo(s) possuem credenciais que expirarão nos próximos 30 dias. Ação preventiva é necessária.`,
        riscoTecnico: 'Credenciais prestes a expirar causarão falhas se não forem renovadas a tempo.',
        impactoNegocio: 'Integrações críticas podem parar de funcionar sem aviso prévio.',
        scoreImpacto: 5,
        status: 'fail',
        evidencias: expiringApps.slice(0, 50),
        affectedEntities: expiringApps.slice(0, 50).map((item: any) => ({
          id: item.app.id,
          displayName: item.app.displayName,
          details: { 
            credentialType: item.cred.type,
            expiresAt: item.cred.endDateTime,
            daysLeft: Math.floor((item.expireDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24)),
          },
        })),
        affectedCount: expiringApps.length,
        endpointUsado: '/applications',
        source: 'graph',
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Applications', 'App registrations', '[App]', 'Certificates & secrets'],
          passosDetalhados: [
            'Planeje a rotação das credenciais',
            'Notifique os responsáveis pelas integrações',
            'Gere novas credenciais antes do vencimento',
            'Atualize as integrações',
            'Remova as credenciais antigas após confirmação',
          ],
          referenciaDocumentacao: 'https://learn.microsoft.com/en-us/entra/identity-platform/howto-create-service-principal-portal',
        },
        detectedAt: now,
      });
    }
    
    console.log(`[APPS] Collected ${insights.length} insights`);
    
  } catch (error) {
    console.error('[APPS] Error:', error);
    return { category: 'apps_integrations', insights, error: String(error) };
  }
  
  return { category: 'apps_integrations', insights };
}

// ============================================================
// COLLECTOR: EMAIL & EXCHANGE
// ============================================================

async function collectExchangeInsights(ctx: CollectorContext): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const now = new Date().toISOString();
  
  try {
    console.log('[EXCHANGE] Starting collection...');
    
    // Fetch users with mailbox
    const users = await graphGetAll(ctx.accessToken, '/users?$filter=mail ne null&$select=id,displayName,userPrincipalName,mail&$top=100&$count=true');
    
    // Extract tenant domains
    const tenantDomains = new Set<string>();
    users.forEach((user: any) => {
      const email = user.mail || user.userPrincipalName;
      if (email && email.includes('@')) {
        tenantDomains.add(email.split('@')[1].toLowerCase());
      }
    });
    
    // Fetch inbox rules for each user (limited to 50 for performance)
    const usersWithRules: any[] = [];
    for (const user of users.slice(0, 50)) {
      try {
        const rulesResponse = await graphGet(ctx.accessToken, `/users/${user.id}/mailFolders/inbox/messageRules`);
        usersWithRules.push({
          ...user,
          rules: rulesResponse.value || [],
        });
      } catch {
        // Skip users without access to rules
      }
    }
    
    // EXO-001: External forwarding rules
    const externalForwarding: any[] = [];
    usersWithRules.forEach(user => {
      (user.rules || []).forEach((rule: any) => {
        if (!rule.isEnabled) return;
        
        const forwardTo = rule.actions?.forwardTo || [];
        const redirectTo = rule.actions?.redirectTo || [];
        const allTargets = [...forwardTo, ...redirectTo];
        
        const externalTargets = allTargets.filter((target: any) => {
          const email = target.emailAddress?.address?.toLowerCase() || '';
          return email && !Array.from(tenantDomains).some(d => email.endsWith(`@${d}`));
        });
        
        if (externalTargets.length > 0) {
          externalForwarding.push({
            user,
            rule,
            externalTargets: externalTargets.map((t: any) => t.emailAddress?.address),
          });
        }
      });
    });
    
    if (externalForwarding.length > 0) {
      insights.push({
        id: 'EXO-001',
        code: 'EXO-001',
        category: 'email_exchange',
        product: 'exchange_online',
        severity: 'critical',
        titulo: 'Regras de redirecionamento para domínios externos',
        descricaoExecutiva: `${externalForwarding.length} regra(s) de inbox estão redirecionando e-mails para endereços externos. Isso pode representar vazamento de dados.`,
        riscoTecnico: 'Regras de forwarding podem ser usadas por atacantes para exfiltrar e-mails sem conhecimento do usuário.',
        impactoNegocio: 'Vazamento de informações confidenciais, segredos comerciais e dados de clientes para terceiros.',
        scoreImpacto: 9,
        status: 'fail',
        evidencias: externalForwarding,
        affectedEntities: externalForwarding.map((item: any) => ({
          id: item.user.id,
          displayName: item.user.displayName,
          userPrincipalName: item.user.userPrincipalName,
          details: {
            ruleName: item.rule.displayName,
            forwardTo: item.externalTargets,
          },
        })),
        affectedCount: externalForwarding.length,
        endpointUsado: '/users/{id}/mailFolders/inbox/messageRules',
        source: 'graph',
        remediacao: {
          productAfetado: 'exchange_online',
          portalUrl: 'https://admin.exchange.microsoft.com',
          caminhoPortal: ['Mail flow', 'Rules', 'Transport rules'],
          comandoPowerShell: 'Get-InboxRule -Mailbox user@domain.com | Where-Object {$_.ForwardTo -or $_.RedirectTo}',
          passosDetalhados: [
            'Revise cada regra identificada com o usuário',
            'Confirme se o redirecionamento é autorizado',
            'Desabilite regras não justificadas',
            'Considere criar política de transporte bloqueando auto-forward externo',
            'Implemente políticas de DLP para dados sensíveis',
          ],
          referenciaDocumentacao: 'https://learn.microsoft.com/en-us/exchange/policy-and-compliance/mail-flow-rules/mail-flow-rules',
        },
        detectedAt: now,
      });
    }
    
    // EXO-002: Delete rules
    const deleteRules: any[] = [];
    usersWithRules.forEach(user => {
      (user.rules || []).forEach((rule: any) => {
        if (rule.isEnabled && rule.actions?.delete === true) {
          deleteRules.push({ user, rule });
        }
      });
    });
    
    if (deleteRules.length > 0) {
      insights.push({
        id: 'EXO-002',
        code: 'EXO-002',
        category: 'email_exchange',
        product: 'exchange_online',
        severity: 'medium',
        titulo: 'Regras de exclusão automática de e-mails',
        descricaoExecutiva: `${deleteRules.length} regra(s) de inbox estão deletando e-mails automaticamente. Isso pode ocultar comunicações importantes.`,
        riscoTecnico: 'Regras de delete podem ser usadas maliciosamente para ocultar alertas de segurança ou comunicações importantes.',
        impactoNegocio: 'Perda de e-mails importantes, falhas de comunicação e possível ocultação de atividades maliciosas.',
        scoreImpacto: 5,
        status: 'fail',
        evidencias: deleteRules,
        affectedEntities: deleteRules.map((item: any) => ({
          id: item.user.id,
          displayName: item.user.displayName,
          userPrincipalName: item.user.userPrincipalName,
          details: { ruleName: item.rule.displayName },
        })),
        affectedCount: deleteRules.length,
        endpointUsado: '/users/{id}/mailFolders/inbox/messageRules',
        source: 'graph',
        remediacao: {
          productAfetado: 'exchange_online',
          portalUrl: 'https://admin.exchange.microsoft.com',
          caminhoPortal: ['Recipients', 'Mailboxes', '[User]', 'Manage mailbox policies'],
          passosDetalhados: [
            'Revise as regras de exclusão automática',
            'Confirme que são necessárias e legítimas',
            'Remova regras suspeitas ou desnecessárias',
            'Monitore criação de novas regras de delete',
          ],
          referenciaDocumentacao: 'https://learn.microsoft.com/en-us/exchange/security-and-compliance/mail-flow-rules/mail-flow-rules',
        },
        detectedAt: now,
      });
    }
    
    console.log(`[EXCHANGE] Collected ${insights.length} insights`);
    
  } catch (error) {
    console.error('[EXCHANGE] Error:', error);
    return { category: 'email_exchange', insights, error: String(error) };
  }
  
  return { category: 'email_exchange', insights };
}

// ============================================================
// COLLECTOR: THREATS & SUSPICIOUS ACTIVITY
// ============================================================

async function collectThreatsInsights(ctx: CollectorContext): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const now = new Date().toISOString();
  const timeRange = { from: ctx.dateFrom, to: ctx.dateTo };
  
  try {
    console.log('[THREATS] Starting collection...');
    
    // Fetch sign-in logs
    let signInLogs: any[] = [];
    try {
      signInLogs = await graphGetAll(
        ctx.accessToken, 
        `/auditLogs/signIns?$filter=createdDateTime ge ${ctx.dateFrom} and createdDateTime le ${ctx.dateTo}&$top=500&$orderby=createdDateTime desc`
      );
    } catch (error: any) {
      if (error.message === 'PERMISSION_DENIED') {
        console.warn('[THREATS] Sign-in logs require Azure AD Premium license');
      }
    }
    
    if (signInLogs.length > 0) {
      // THR-001: Risky sign-ins
      const riskySignIns = signInLogs.filter((log: any) => 
        log.riskState && log.riskState !== 'none' && log.riskState !== 'remediated'
      );
      
      if (riskySignIns.length > 0) {
        const usersMap = new Map<string, any>();
        riskySignIns.forEach((log: any) => {
          if (!usersMap.has(log.userId)) {
            usersMap.set(log.userId, {
              id: log.userId,
              displayName: log.userDisplayName || 'Desconhecido',
              userPrincipalName: log.userPrincipalName || '',
              riskState: log.riskState,
              riskLevel: log.riskLevelDuringSignIn,
            });
          }
        });
        
        const affectedUsers = Array.from(usersMap.values());
        const hasCritical = riskySignIns.some((l: any) => l.riskLevelDuringSignIn === 'high');
        
        insights.push({
          id: 'THR-001',
          code: 'THR-001',
          category: 'threats_activity',
          product: 'entra_id',
          severity: hasCritical ? 'critical' : 'high',
          titulo: 'Usuários com logins suspeitos detectados',
          descricaoExecutiva: `${affectedUsers.length} usuário(s) apresentaram indicadores de risco durante o login. Isso pode indicar tentativas de acesso não autorizadas.`,
          riscoTecnico: 'Logins com risco detectado podem indicar credential stuffing, phishing bem-sucedido ou uso de credenciais vazadas.',
          impactoNegocio: 'Contas comprometidas podem acessar dados sensíveis, enviar e-mails maliciosos ou escalar privilégios.',
          scoreImpacto: 8,
          status: 'fail',
          evidencias: riskySignIns.slice(0, 50),
          affectedEntities: affectedUsers.map((user: any) => ({
            id: user.id,
            displayName: user.displayName,
            userPrincipalName: user.userPrincipalName,
            details: { riskState: user.riskState, riskLevel: user.riskLevel },
          })),
          affectedCount: affectedUsers.length,
          endpointUsado: '/auditLogs/signIns',
          source: 'graph',
          remediacao: {
            productAfetado: 'entra_id',
            portalUrl: 'https://entra.microsoft.com',
            caminhoPortal: ['Protection', 'Identity Protection', 'Risky users'],
            passosDetalhados: [
              'Acesse Identity Protection > Risky users',
              'Revise cada usuário com risco detectado',
              'Para riscos confirmados, force redefinição de senha',
              'Revogue sessões ativas (Revoke sessions)',
              'Investigue os logs detalhados de cada login',
            ],
            referenciaDocumentacao: 'https://learn.microsoft.com/en-us/entra/id-protection/howto-identity-protection-investigate-risk',
          },
          detectedAt: now,
          timeRange,
        });
      }
      
      // THR-002: Failed logins followed by success
      const loginsByUser = new Map<string, any[]>();
      signInLogs.forEach((log: any) => {
        const existing = loginsByUser.get(log.userId) || [];
        existing.push(log);
        loginsByUser.set(log.userId, existing);
      });
      
      const suspiciousPatterns: any[] = [];
      loginsByUser.forEach((logs, userId) => {
        logs.sort((a, b) => new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime());
        
        let consecutiveFailures = 0;
        for (const log of logs) {
          if (log.status?.errorCode && log.status.errorCode !== 0) {
            consecutiveFailures++;
          } else if (consecutiveFailures >= 3) {
            suspiciousPatterns.push({
              userId,
              displayName: log.userDisplayName,
              userPrincipalName: log.userPrincipalName,
              failuresBeforeSuccess: consecutiveFailures,
              successAt: log.createdDateTime,
            });
            break;
          } else {
            consecutiveFailures = 0;
          }
        }
      });
      
      if (suspiciousPatterns.length > 0) {
        insights.push({
          id: 'THR-002',
          code: 'THR-002',
          category: 'threats_activity',
          product: 'entra_id',
          severity: 'critical',
          titulo: 'Login bem-sucedido após várias falhas',
          descricaoExecutiva: `${suspiciousPatterns.length} usuário(s) obtiveram sucesso no login após múltiplas tentativas falhas. Isso pode indicar ataque de força bruta bem-sucedido.`,
          riscoTecnico: 'Padrão clássico de brute-force: várias tentativas incorretas seguidas de sucesso indica que a senha foi descoberta.',
          impactoNegocio: 'Conta comprometida com acesso confirmado. Atacante pode já estar operando dentro do ambiente.',
          scoreImpacto: 10,
          status: 'fail',
          evidencias: suspiciousPatterns,
          affectedEntities: suspiciousPatterns.map((p: any) => ({
            id: p.userId,
            displayName: p.displayName || 'Desconhecido',
            userPrincipalName: p.userPrincipalName || '',
            details: { 
              failuresBeforeSuccess: p.failuresBeforeSuccess,
              successAt: p.successAt,
            },
          })),
          affectedCount: suspiciousPatterns.length,
          endpointUsado: '/auditLogs/signIns',
          source: 'graph',
          remediacao: {
            productAfetado: 'entra_id',
            portalUrl: 'https://entra.microsoft.com',
            caminhoPortal: ['Users', '[User]', 'Sign-in logs'],
            passosDetalhados: [
              'AÇÃO IMEDIATA: Force logout de todas as sessões',
              'Exija redefinição de senha imediata',
              'Revise os logs detalhados do usuário',
              'Verifique se há atividades suspeitas pós-login',
              'Considere habilitar MFA se não estiver ativo',
            ],
            referenciaDocumentacao: 'https://learn.microsoft.com/en-us/entra/identity/monitoring-health/concept-sign-ins',
          },
          detectedAt: now,
          timeRange,
        });
      }
    }
    
    console.log(`[THREATS] Collected ${insights.length} insights`);
    
  } catch (error) {
    console.error('[THREATS] Error:', error);
    return { category: 'threats_activity', insights, error: String(error) };
  }
  
  return { category: 'threats_activity', insights };
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { tenant_record_id, date_from, date_to } = await req.json();
    
    if (!tenant_record_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_record_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[POSTURE] Starting analysis for tenant ${tenant_record_id}`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch tenant info
    const { data: tenant, error: tenantError } = await supabase
      .from('m365_tenants')
      .select('*, m365_app_credentials(*)')
      .eq('id', tenant_record_id)
      .single();
    
    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get credentials
    const credentials = tenant.m365_app_credentials;
    if (!credentials || !credentials.client_secret_encrypted) {
      return new Response(
        JSON.stringify({ success: false, error: 'Credenciais não configuradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Decrypt and get access token
    const clientSecret = await decryptSecret(credentials.client_secret_encrypted);
    const accessToken = await getAccessToken(tenant.tenant_id, credentials.azure_app_id, clientSecret);
    
    // Set date range (default: last 7 days)
    const now = new Date();
    const dateTo = date_to || now.toISOString();
    const dateFrom = date_from || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const ctx: CollectorContext = {
      accessToken,
      tenantId: tenant.tenant_id,
      dateFrom,
      dateTo,
    };
    
    // Run collectors in parallel
    console.log('[POSTURE] Running collectors in parallel...');
    const results = await Promise.allSettled([
      collectIdentityInsights(ctx),
      collectAdminPrivilegesInsights(ctx),
      collectAppsInsights(ctx),
      collectExchangeInsights(ctx),
      collectThreatsInsights(ctx),
    ]);
    
    // Aggregate insights
    const allInsights: M365Insight[] = [];
    const errors: string[] = [];
    
    results.forEach((result, index) => {
      const categories = ['identities', 'admin_privileges', 'apps_integrations', 'email_exchange', 'threats_activity'];
      if (result.status === 'fulfilled') {
        allInsights.push(...result.value.insights);
        if (result.value.error) {
          errors.push(`${categories[index]}: ${result.value.error}`);
        }
      } else {
        errors.push(`${categories[index]}: ${result.reason}`);
      }
    });
    
    // Calculate score and summary
    const score = calculatePostureScore(allInsights);
    const classification = getClassification(score);
    
    const summary = {
      critical: allInsights.filter(i => i.status === 'fail' && i.severity === 'critical').length,
      high: allInsights.filter(i => i.status === 'fail' && i.severity === 'high').length,
      medium: allInsights.filter(i => i.status === 'fail' && i.severity === 'medium').length,
      low: allInsights.filter(i => i.status === 'fail' && i.severity === 'low').length,
      info: allInsights.filter(i => i.status === 'fail' && i.severity === 'info').length,
      total: allInsights.filter(i => i.status === 'fail').length,
    };
    
    // Category breakdown
    const categoryBreakdown = [
      'identities', 'auth_access', 'admin_privileges', 'apps_integrations', 'email_exchange', 'threats_activity'
    ].map(cat => {
      const catInsights = allInsights.filter(i => i.category === cat);
      const failed = catInsights.filter(i => i.status === 'fail');
      return {
        category: cat,
        label: {
          identities: 'Identidades',
          auth_access: 'Autenticação & Acesso',
          admin_privileges: 'Privilégios Administrativos',
          apps_integrations: 'Aplicações & Integrações',
          email_exchange: 'Email & Exchange',
          threats_activity: 'Ameaças & Atividades Suspeitas',
        }[cat] || cat,
        count: catInsights.length,
        failCount: failed.length,
        score: calculatePostureScore(catInsights),
        criticalCount: failed.filter(i => i.severity === 'critical').length,
        highCount: failed.filter(i => i.severity === 'high').length,
      };
    });
    
    console.log(`[POSTURE] Analysis complete. Score: ${score}, Insights: ${allInsights.length}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        score,
        classification,
        summary,
        categoryBreakdown,
        insights: allInsights,
        tenant: {
          id: tenant.tenant_id,
          domain: tenant.tenant_domain || tenant.display_name,
          displayName: tenant.display_name,
        },
        analyzedAt: now.toISOString(),
        analyzedPeriod: { from: dateFrom, to: dateTo },
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[POSTURE] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
