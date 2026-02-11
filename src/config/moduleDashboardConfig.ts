export interface ModuleDashboardConfig {
  /** Key used in the stats Record (e.g. "firewall", "m365") */
  statsKey: string;
  /** Main route for the module */
  path: string;
  /** Label shown in the infrastructure card (e.g. "Firewalls", "Tenants M365") */
  infraLabel: string;
  /** Hide severity counters in the health card? */
  hideSeverities?: boolean;
}

export const MODULE_DASHBOARD_CONFIG: Record<string, ModuleDashboardConfig> = {
  scope_firewall: {
    statsKey: 'firewall',
    path: '/scope-firewall/dashboard',
    infraLabel: 'Firewalls',
  },
  scope_m365: {
    statsKey: 'm365',
    path: '/scope-m365/posture',
    infraLabel: 'Tenants M365',
    hideSeverities: true,
  },
  scope_external_domain: {
    statsKey: 'externalDomain',
    path: '/scope-external-domain/domains',
    infraLabel: 'Domínios',
  },
  scope_network: {
    statsKey: 'network',
    path: '/scope-network/dashboard',
    infraLabel: 'Network',
  },
  scope_cloud: {
    statsKey: 'cloud',
    path: '/scope-cloud/dashboard',
    infraLabel: 'Cloud',
  },
};
