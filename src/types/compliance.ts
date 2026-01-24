export type ComplianceStatus = 'pass' | 'fail' | 'warning' | 'pending';

export interface EvidenceItem {
  label: string;
  value: string;
  type?: 'text' | 'code' | 'list' | 'json';
}

export interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  status: ComplianceStatus;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation?: string;
  details?: string;
  evidence?: EvidenceItem[];
  rawData?: Record<string, unknown>;
  apiEndpoint?: string;
}

export interface ComplianceCategory {
  name: string;
  icon: string;
  checks: ComplianceCheck[];
  passRate: number;
}

export interface ConnectionConfig {
  url: string;
  apiKey: string;
  verified: boolean;
}

export interface ComplianceReport {
  overallScore: number;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  categories: ComplianceCategory[];
  generatedAt: Date;
  firmwareVersion?: string;
  cves?: CVEInfo[];
  // System info from report
  systemInfo?: {
    hostname?: string;
    model?: string;
    serial?: string;
  };
}

export interface CVEInfo {
  id: string;
  description: string;
  severity: string;
  score: number;
  publishedDate: string;
  lastModifiedDate: string;
  references: string[];
}
