import { ComplianceCategory } from '@/types/compliance';
import { ComplianceCard } from './ComplianceCard';
import { Shield, Network, Lock, Activity, Download, ChevronDown, ChevronUp, Monitor, ArrowDownToLine, ShieldCheck, ServerCog, HardDrive, Award } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CategorySectionProps {
  category: ComplianceCategory;
  index: number;
  variant?: 'default' | 'external_domain';
}

const iconMap: Record<string, typeof Shield> = {
  shield: Shield,
  network: Network,
  lock: Lock,
  activity: Activity,
  download: Download,
  monitor: Monitor,
  arrowDownToLine: ArrowDownToLine,
  shieldCheck: ShieldCheck,
  serverCog: ServerCog,
  hardDrive: HardDrive,
  award: Award,
};

// Descritivos de cada categoria de análise
const categoryDescriptions: Record<string, string> = {
  'Segurança de Interfaces': 'Verifica configurações de acesso às interfaces de gerenciamento, incluindo protocolos inseguros como HTTP e Telnet, e exposição de serviços administrativos em interfaces externas.',
  'Regras de Entrada': 'Analisa políticas de firewall que permitem tráfego de entrada da internet, identificando exposições de serviços críticos como RDP e SMB, e regras sem restrição de origem.',
  'Configuração de Rede': 'Avalia configurações gerais de rede, incluindo regras permissivas (any-any), segmentação e políticas de acesso entre zonas.',
  'Políticas de Segurança': 'Examina configurações de autenticação administrativa, incluindo 2FA, políticas de senha, timeout de sessão e lockout de conta.',
  'Atualização de Firmware': 'Verifica a versão do FortiOS instalada, identifica atualizações disponíveis e compara com as releases mais recentes recomendadas pela Fortinet.',
  'Perfis de Segurança UTM': 'Analisa a aplicação de perfis de segurança (IPS, Antivírus, Web Filter, App Control) nas políticas de firewall, especialmente em regras de saída para internet.',
  'Configuração VPN': 'Avalia configurações de VPN IPSec e SSL VPN, incluindo algoritmos de criptografia, certificados e práticas de segurança.',
  'Logging e Monitoramento': 'Verifica configurações de log, integração com FortiAnalyzer/FortiCloud e habilitação de logging para eventos de segurança.',
  'Licenciamento': 'Verifica o status do contrato FortiCare e licenças de segurança FortiGuard (AV, IPS, WebFilter, AppControl), incluindo datas de expiração.',
};

export function CategorySection({ category, index, variant = 'default' }: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const Icon = iconMap[category.icon] || Shield;

  const getPassRateColor = () => {
    if (category.passRate >= 80) return 'text-success';
    if (category.passRate >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div 
      className="animate-slide-in mb-10"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 glass-card rounded-lg mb-3 hover:border-primary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground">{category.name}</h3>
            <p className="text-sm text-muted-foreground">
              {category.checks.length} verificações
            </p>
            {categoryDescriptions[category.name] && (
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-xl">
                {categoryDescriptions[category.name]}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Não mostrar percentual para categoria Recomendações - é apenas informativo */}
          {category.name !== 'Recomendações' && (
            <div className="text-right">
              <span className={cn("text-2xl font-bold tabular-nums", getPassRateColor())}>
                {category.passRate}%
              </span>
              <p className="text-xs text-muted-foreground">aprovação</p>
            </div>
          )}
          {category.name === 'Recomendações' && (
            <div className="text-right">
              <span className="text-sm text-muted-foreground font-medium">
                Sugestões de melhoria
              </span>
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-3 pl-4 border-l-2 border-primary/20 ml-6 mb-6">
          {category.checks.map((check) => (
            <ComplianceCard key={check.id} check={check} variant={variant} />
          ))}
        </div>
      )}
    </div>
  );
}
