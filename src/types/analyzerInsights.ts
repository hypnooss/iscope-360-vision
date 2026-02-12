// Analyzer - Firewall Security Intelligence Types

export type AnalyzerSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AnalyzerCategory =
  | 'denied_traffic'
  | 'authentication'
  | 'ips_ids'
  | 'dns_security'
  | 'config_changes'
  | 'traffic_behavior'
  | 'lateral_movement'
  | 'persistent_sessions'
  | 'geolocation'
  | 'ioc_correlation';

export interface AnalyzerInsight {
  id: string;
  category: AnalyzerCategory;
  name: string;
  description: string;
  severity: AnalyzerSeverity;
  details?: string;
  sourceIPs?: string[];
  targetPorts?: number[];
  affectedUsers?: string[];
  count?: number;
  timeWindow?: string;
  recommendation?: string;
}

export interface AnalyzerSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface TopBlockedIP {
  ip: string;
  country?: string;
  count: number;
  targetPorts: number[];
}

export interface TopCountry {
  country: string;
  code?: string;
  count: number;
}

export interface AnalyzerMetrics {
  topBlockedIPs: TopBlockedIP[];
  topCountries: TopCountry[];
  vpnFailures: number;
  firewallAuthFailures: number;
  topAuthIPs: TopBlockedIP[];
  topAuthCountries: TopCountry[];
  ipsEvents: number;
  configChanges: number;
  totalDenied: number;
  totalEvents: number;
}

export interface AnalyzerSnapshot {
  id: string;
  firewall_id: string;
  client_id: string;
  agent_task_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  period_start?: string;
  period_end?: string;
  score?: number;
  summary: AnalyzerSummary;
  insights: AnalyzerInsight[];
  metrics: AnalyzerMetrics;
  created_at: string;
}
