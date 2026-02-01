import { ComplianceCategory } from '@/types/compliance';
import { ComplianceCard } from './ComplianceCard';
import { Shield, ChevronDown, ChevronUp } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  getCategoryConfig, 
  AVAILABLE_COLORS,
  type CategoryConfig,
} from '@/hooks/useCategoryConfig';

interface CategorySectionProps {
  category: ComplianceCategory;
  index: number;
  variant?: 'default' | 'external_domain';
  categoryConfigs?: CategoryConfig[];
}

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

// Dynamic icon component
function DynamicIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const iconName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') as keyof typeof LucideIcons;
  
  const IconComponent = LucideIcons[iconName] as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  
  if (!IconComponent) {
    return <Shield className={className} style={style} />;
  }
  
  return <IconComponent className={className} style={style} />;
}

export function CategorySection({ category, index, variant = 'default', categoryConfigs }: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Get config from database or use defaults
  const config = getCategoryConfig(categoryConfigs, category.name);
  const colorOption = AVAILABLE_COLORS.find(c => c.name === config.color);
  const colorHex = colorOption?.hex || '#64748b';

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
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${colorHex}15` }}
          >
            <DynamicIcon 
              name={config.icon} 
              className="w-5 h-5" 
              style={{ color: colorHex }}
            />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground">{config.displayName}</h3>
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
        <div 
          className="space-y-3 pl-4 ml-6 mb-6"
          style={{ 
            borderLeftWidth: '2px',
            borderLeftColor: `${colorHex}30`,
          }}
        >
          {category.checks.map((check) => (
            <ComplianceCard key={check.id} check={check} variant={variant} />
          ))}
        </div>
      )}
    </div>
  );
}
