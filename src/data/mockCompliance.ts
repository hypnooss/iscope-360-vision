import { ComplianceCheck, ComplianceReport } from '@/types/compliance';

export const mockComplianceChecks: ComplianceCheck[] = [
  // Security Policies
  {
    id: 'sec-001',
    name: 'Política de Senha Forte',
    description: 'Verifica se políticas de senha forte estão configuradas',
    category: 'Políticas de Segurança',
    status: 'pass',
    severity: 'critical',
    recommendation: 'Manter configuração atual',
  },
  {
    id: 'sec-002',
    name: 'Autenticação de Dois Fatores',
    description: 'Verifica se 2FA está habilitado para acesso administrativo',
    category: 'Políticas de Segurança',
    status: 'fail',
    severity: 'critical',
    recommendation: 'Habilitar autenticação de dois fatores para todos os administradores',
    details: 'Apenas 2 de 5 administradores possuem 2FA habilitado',
  },
  {
    id: 'sec-003',
    name: 'Timeout de Sessão',
    description: 'Verifica configuração de timeout de sessão administrativa',
    category: 'Políticas de Segurança',
    status: 'warning',
    severity: 'medium',
    recommendation: 'Reduzir timeout de sessão para 15 minutos',
    details: 'Timeout atual: 60 minutos. Recomendado: 15 minutos',
  },

  // Interface Security - NEW
  {
    id: 'int-001',
    name: 'Protocolo HTTP na Interface de Gerência',
    description: 'Verifica se HTTP (não criptografado) está habilitado nas interfaces',
    category: 'Segurança de Interfaces',
    status: 'fail',
    severity: 'critical',
    recommendation: 'Desabilitar HTTP e utilizar apenas HTTPS para acesso administrativo',
    details: 'HTTP habilitado nas interfaces: port1 (WAN), port3 (DMZ). Isso expõe credenciais em texto claro.',
  },
  {
    id: 'int-002',
    name: 'Protocolo Telnet Ativo',
    description: 'Verifica se Telnet está habilitado nas interfaces de gerenciamento',
    category: 'Segurança de Interfaces',
    status: 'fail',
    severity: 'critical',
    recommendation: 'Desabilitar Telnet imediatamente e utilizar apenas SSH',
    details: 'Telnet habilitado nas interfaces: port1 (WAN), port2 (LAN). Telnet transmite dados sem criptografia.',
  },
  {
    id: 'int-003',
    name: 'SSH em Interface Externa',
    description: 'Verifica se SSH está exposto em interfaces WAN',
    category: 'Segurança de Interfaces',
    status: 'warning',
    severity: 'high',
    recommendation: 'Restringir acesso SSH apenas a IPs de gerenciamento confiáveis',
    details: 'SSH habilitado na interface port1 (WAN) sem trusted hosts configurados',
  },
  {
    id: 'int-004',
    name: 'PING (ICMP) em Interface WAN',
    description: 'Verifica se ICMP está habilitado em interfaces externas',
    category: 'Segurança de Interfaces',
    status: 'warning',
    severity: 'low',
    recommendation: 'Considerar desabilitar PING na interface WAN para reduzir superfície de ataque',
    details: 'PING habilitado em port1 (WAN). Pode facilitar reconhecimento por atacantes.',
  },

  // Network Configuration
  {
    id: 'net-001',
    name: 'Segmentação de Rede',
    description: 'Verifica se VLANs estão corretamente segmentadas',
    category: 'Configuração de Rede',
    status: 'pass',
    severity: 'high',
  },
  {
    id: 'net-002',
    name: 'Regras de Firewall Obsoletas',
    description: 'Identifica regras de firewall não utilizadas há mais de 90 dias',
    category: 'Configuração de Rede',
    status: 'warning',
    severity: 'medium',
    recommendation: 'Revisar e remover 23 regras não utilizadas',
    details: '23 regras não receberam tráfego nos últimos 90 dias',
  },
  {
    id: 'net-003',
    name: 'Regras "Any-Any"',
    description: 'Verifica existência de regras permissivas demais',
    category: 'Configuração de Rede',
    status: 'fail',
    severity: 'critical',
    recommendation: 'Remover ou restringir regras any-any identificadas',
    details: '3 regras com source e destination "any" encontradas',
  },

  // Inbound Rules - NEW
  {
    id: 'inb-001',
    name: 'Regras de Entrada sem Restrição de Origem',
    description: 'Identifica regras de entrada (WAN→LAN) que aceitam qualquer IP de origem',
    category: 'Regras de Entrada',
    status: 'fail',
    severity: 'critical',
    recommendation: 'Restringir origem das regras para IPs ou ranges específicos',
    details: '5 regras de entrada com source "all" detectadas:\n• Regra #12: WAN→DMZ porta 443 (origem: all)\n• Regra #15: WAN→LAN porta 3389/RDP (origem: all) ⚠️ CRÍTICO\n• Regra #18: WAN→DMZ porta 22/SSH (origem: all)\n• Regra #23: WAN→LAN porta 445/SMB (origem: all) ⚠️ CRÍTICO\n• Regra #31: WAN→DMZ portas 80,443 (origem: all)',
  },
  {
    id: 'inb-002',
    name: 'RDP Exposto para Internet',
    description: 'Verifica se há regras expondo RDP (3389) para a internet',
    category: 'Regras de Entrada',
    status: 'fail',
    severity: 'critical',
    recommendation: 'Remover acesso RDP direto da internet. Utilizar VPN ou bastion host',
    details: 'Regra #15 permite acesso RDP de qualquer IP externo. RDP é alvo frequente de ataques de força bruta e ransomware.',
  },
  {
    id: 'inb-003',
    name: 'SMB/CIFS Exposto para Internet',
    description: 'Verifica se há regras expondo portas SMB (445, 139) para a internet',
    category: 'Regras de Entrada',
    status: 'fail',
    severity: 'critical',
    recommendation: 'Bloquear imediatamente portas SMB da internet',
    details: 'Regra #23 permite acesso SMB de qualquer IP externo. Vetor conhecido para ransomware (WannaCry, NotPetya).',
  },
  {
    id: 'inb-004',
    name: 'Regras de Entrada com Geo-Blocking',
    description: 'Verifica se há restrição geográfica nas regras de entrada',
    category: 'Regras de Entrada',
    status: 'warning',
    severity: 'medium',
    recommendation: 'Implementar geo-blocking para países sem necessidade de acesso',
    details: 'Nenhuma regra de entrada possui restrição geográfica configurada',
  },

  // VPN Configuration
  {
    id: 'vpn-001',
    name: 'Criptografia VPN',
    description: 'Verifica se algoritmos de criptografia fortes estão em uso',
    category: 'Configuração VPN',
    status: 'pass',
    severity: 'critical',
  },
  {
    id: 'vpn-002',
    name: 'Certificados VPN',
    description: 'Verifica validade dos certificados SSL/TLS',
    category: 'Configuração VPN',
    status: 'warning',
    severity: 'high',
    recommendation: 'Renovar certificado que expira em 30 dias',
    details: 'Certificado "vpn-main" expira em 28/02/2026',
  },

  // Logging & Monitoring
  {
    id: 'log-001',
    name: 'Log de Eventos',
    description: 'Verifica se logging está habilitado para eventos críticos',
    category: 'Logging e Monitoramento',
    status: 'pass',
    severity: 'high',
  },
  {
    id: 'log-002',
    name: 'Retenção de Logs',
    description: 'Verifica política de retenção de logs',
    category: 'Logging e Monitoramento',
    status: 'pass',
    severity: 'medium',
  },
  {
    id: 'log-003',
    name: 'Alertas de Segurança',
    description: 'Verifica configuração de alertas para eventos de segurança',
    category: 'Logging e Monitoramento',
    status: 'warning',
    severity: 'medium',
    recommendation: 'Configurar alertas por email para tentativas de login falhas',
  },

  // Updates & Patches
  {
    id: 'upd-001',
    name: 'Versão do Firmware',
    description: 'Verifica se o firmware está atualizado',
    category: 'Atualizações',
    status: 'fail',
    severity: 'high',
    recommendation: 'Atualizar para FortiOS 7.4.3',
    details: 'Versão atual: 7.2.5. Última versão: 7.4.3',
  },
  {
    id: 'upd-002',
    name: 'Assinaturas IPS',
    description: 'Verifica atualização das assinaturas de IPS',
    category: 'Atualizações',
    status: 'pass',
    severity: 'critical',
  },
];

export function generateMockReport(): ComplianceReport {
  const checks = mockComplianceChecks;
  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  
  const categories = [
    'Políticas de Segurança',
    'Segurança de Interfaces',
    'Configuração de Rede',
    'Regras de Entrada',
    'Configuração VPN',
    'Logging e Monitoramento',
    'Atualizações',
  ];

  const categoryData = categories.map(cat => {
    const catChecks = checks.filter(c => c.category === cat);
    const catPassed = catChecks.filter(c => c.status === 'pass').length;
    return {
      name: cat,
      icon: getCategoryIcon(cat),
      checks: catChecks,
      passRate: catChecks.length > 0 ? Math.round((catPassed / catChecks.length) * 100) : 0,
    };
  });

  return {
    overallScore: Math.round((passed / checks.length) * 100),
    totalChecks: checks.length,
    passed,
    failed,
    warnings,
    categories: categoryData,
    generatedAt: new Date(),
  };
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'Políticas de Segurança': 'shield',
    'Segurança de Interfaces': 'monitor',
    'Configuração de Rede': 'network',
    'Regras de Entrada': 'arrowDownToLine',
    'Configuração VPN': 'lock',
    'Logging e Monitoramento': 'activity',
    'Atualizações': 'download',
  };
  return icons[category] || 'check';
}
