import { ComplianceCheck, ComplianceStatus } from '@/types/compliance';
import { M365Insight, M365AgentInsight } from '@/types/m365Insights';
import { SecurityInsight } from '@/types/securityInsights';
import { ExchangeInsight } from '@/types/exchangeInsights';
import { ApplicationInsight } from '@/types/applicationInsights';
import { UnifiedComplianceItem, UnifiedComplianceStatus, UnifiedComplianceSeverity } from '@/types/unifiedCompliance';

/**
 * Normaliza status de diferentes fontes para o formato unificado
 */
function normalizeStatus(status: string): UnifiedComplianceStatus {
  switch (status) {
    case 'pass': return 'pass';
    case 'fail': return 'fail';
    case 'warn':
    case 'warning': return 'warning';
    case 'not_found': return 'not_found';
    case 'pending':
    case 'unknown':
    default: return 'unknown';
  }
}

/**
 * Normaliza severidade
 */
function normalizeSeverity(severity: string): UnifiedComplianceSeverity {
  switch (severity) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'medium': return 'medium';
    case 'low': return 'low';
    case 'info':
    default: return 'info';
  }
}

/**
 * Mapeia ComplianceCheck (Firewall / Domínio Externo) para UnifiedComplianceItem
 */
export function mapComplianceCheck(check: ComplianceCheck): UnifiedComplianceItem {
  const status = normalizeStatus(check.status as string);
  return {
    id: check.id,
    code: check.id, // ComplianceCheck não tem code separado, usa id
    name: check.name,
    description: check.description,
    category: check.category,
    status,
    severity: normalizeSeverity(check.severity),
    failDescription: check.description,
    recommendation: check.recommendation,
    technicalRisk: check.technicalRisk,
    businessImpact: check.businessImpact,
    apiEndpoint: check.apiEndpoint,
    evidence: check.evidence,
    rawData: check.rawData,
    details: check.details,
  };
}

/**
 * Mapeia M365Insight (Postura M365 - Graph API) para UnifiedComplianceItem
 */
export function mapM365Insight(insight: M365Insight): UnifiedComplianceItem {
  return {
    id: insight.id,
    code: insight.code,
    name: insight.titulo,
    description: insight.descricaoExecutiva,
    category: insight.category,
    status: normalizeStatus(insight.status),
    severity: normalizeSeverity(insight.severity),
    failDescription: insight.descricaoExecutiva,
    recommendation: insight.remediacao?.passosDetalhados?.[0],
    technicalRisk: insight.riscoTecnico,
    businessImpact: insight.impactoNegocio,
    apiEndpoint: insight.endpointUsado,
    affectedEntities: insight.affectedEntities,
    affectedCount: insight.affectedCount,
    remediation: insight.remediacao,
    product: insight.product,
    source: insight.source,
  };
}

/**
 * Mapeia M365AgentInsight (Postura M365 - Agent/PowerShell) para UnifiedComplianceItem
 */
export function mapM365AgentInsight(insight: M365AgentInsight): UnifiedComplianceItem {
  return {
    id: insight.id,
    code: insight.id, // Agent insights usam o code como id
    name: insight.name,
    description: insight.description,
    category: insight.category,
    status: normalizeStatus(insight.status),
    severity: normalizeSeverity(insight.severity),
    failDescription: insight.description,
    recommendation: insight.recommendation,
    details: insight.details,
    rawData: insight.rawData,
    affectedEntities: insight.affectedEntities?.map((e, i) => ({
      id: `${insight.id}-${i}`,
      displayName: e.name,
      details: e.details ? { info: e.details } : undefined,
    })),
    affectedCount: insight.affectedEntities?.length || 0,
  };
}

/**
 * Mapeia SecurityInsight (Entra ID Security) para UnifiedComplianceItem
 */
export function mapSecurityInsight(insight: SecurityInsight): UnifiedComplianceItem {
  return {
    id: insight.id,
    code: insight.code,
    name: insight.title,
    description: insight.criteria,
    category: insight.category,
    status: 'fail', // SecurityInsights são sempre problemas detectados
    severity: normalizeSeverity(insight.severity),
    failDescription: insight.description,
    details: insight.description,
    recommendation: insight.recommendation,
    affectedEntities: insight.affectedUsers.map(u => ({
      id: u.id,
      displayName: u.displayName,
      userPrincipalName: u.userPrincipalName,
      details: u.details,
    })),
    affectedCount: insight.affectedCount,
    product: 'entra_id',
  };
}

/**
 * Mapeia ExchangeInsight (Exchange Online) para UnifiedComplianceItem
 */
export function mapExchangeInsight(insight: ExchangeInsight): UnifiedComplianceItem {
  return {
    id: insight.id,
    code: insight.code,
    name: insight.title,
    description: insight.criteria,
    category: insight.category,
    status: 'fail', // ExchangeInsights são sempre problemas detectados
    severity: normalizeSeverity(insight.severity),
    failDescription: insight.description,
    details: insight.description,
    recommendation: insight.recommendation,
    affectedEntities: insight.affectedMailboxes.map(m => ({
      id: m.id,
      displayName: m.displayName,
      userPrincipalName: m.userPrincipalName,
      details: m.details as Record<string, unknown> | undefined,
    })),
    affectedCount: insight.affectedCount,
    product: 'exchange_online',
  };
}

/**
 * Mapeia ApplicationInsight (Entra ID Applications) para UnifiedComplianceItem
 */
export function mapApplicationInsight(insight: ApplicationInsight): UnifiedComplianceItem {
  return {
    id: insight.id,
    code: insight.code,
    name: insight.title,
    description: insight.criteria,
    category: insight.category,
    status: 'fail', // ApplicationInsights são sempre problemas detectados
    severity: normalizeSeverity(insight.severity),
    failDescription: insight.description,
    details: insight.description,
    recommendation: insight.recommendation,
    affectedEntities: insight.affectedApplications.map(a => ({
      id: a.id,
      displayName: a.displayName,
      details: a.details as Record<string, unknown> | undefined,
    })),
    affectedCount: insight.affectedCount,
    product: 'entra_id',
  };
}
