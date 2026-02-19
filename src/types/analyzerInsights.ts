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
  | 'ioc_correlation'
  | 'anomaly';

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

export interface TopCategory {
  category: string;
  count: number;
}

export interface TopUserIP {
  user: string;
  ip?: string;
  count: number;
}

export interface ConfigChangeDetail {
  user: string;
  action: string;
  cfgpath: string;
  cfgobj: string;
  cfgattr: string;
  msg: string;
  date: string;
  category: string;
  severity: string;
}

export interface AnalyzerMetrics {
  topBlockedIPs: TopBlockedIP[];
  topCountries: TopCountry[];
  vpnFailures: number;
  firewallAuthFailures: number;
  firewallAuthSuccesses: number;
  vpnSuccesses: number;
  topAuthIPs: TopBlockedIP[];
  topAuthCountries: TopCountry[];
  topAuthIPsSuccess: TopBlockedIP[];
  topAuthIPsFailed: TopBlockedIP[];
  topAuthCountriesSuccess: TopCountry[];
  topAuthCountriesFailed: TopCountry[];
  // Separated FW auth rankings
  topFwAuthIPsFailed: TopBlockedIP[];
  topFwAuthIPsSuccess: TopBlockedIP[];
  topFwAuthCountriesFailed: TopCountry[];
  topFwAuthCountriesSuccess: TopCountry[];
  // Separated VPN auth rankings
  topVpnAuthIPsFailed: TopBlockedIP[];
  topVpnAuthIPsSuccess: TopBlockedIP[];
  topVpnAuthCountriesFailed: TopCountry[];
  topVpnAuthCountriesSuccess: TopCountry[];
  // Outbound connections
  topOutboundIPs: TopBlockedIP[];
  topOutboundCountries: TopCountry[];
  outboundConnections: number;
  ipsEvents: number;
  configChanges: number;
  configChangeDetails: ConfigChangeDetail[];
  totalDenied: number;
  totalEvents: number;
  topWebFilterCategories: TopCategory[];
  topWebFilterUsers: TopUserIP[];
  topAppControlApps: TopCategory[];
  topAppControlUsers: TopUserIP[];
  webFilterBlocked: number;
  appControlBlocked: number;
  anomalyEvents: number;
  anomalyDropped: number;
  topAnomalySources: TopBlockedIP[];
  topAnomalyTypes: TopCategory[];
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
