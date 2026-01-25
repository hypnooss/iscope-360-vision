
# Plano: Restaurar Evidências de Coleta na Análise de Compliance

## Contexto do Problema

Após a migração para coleta de dados via Agent, as evidências das verificações de compliance pararam de ser exibidas. O sistema antigo (`fortigate-compliance`) gerava evidências de forma hardcoded, enquanto o novo sistema (`agent-task-result`) processa regras genéricas sem incluir os campos `evidence`, `rawData` e `apiEndpoint` nos checks.

## Solução Proposta

A solução envolve duas partes:
1. **Backend**: Atualizar o `agent-task-result` para popular automaticamente evidências a partir dos dados coletados
2. **Frontend**: Restringir a exibição das evidências apenas para perfis `super_admin` e `super_suporte`

---

## Parte 1: Atualização do Backend (agent-task-result)

### Arquivo: `supabase/functions/agent-task-result/index.ts`

#### 1.1. Atualizar a interface `ComplianceCheck` para incluir os campos de evidência

```typescript
interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  details: string;
  recommendation?: string;
  weight: number;
  // Novos campos para evidências
  evidence?: Array<{ label: string; value: string; type: 'text' | 'code' }>;
  rawData?: Record<string, unknown>;
  apiEndpoint?: string;
}
```

#### 1.2. Atualizar o `processComplianceRules` para gerar evidências automaticamente

A função será modificada para:
- Extrair o valor avaliado e incluí-lo como evidência
- Mapear o `source_key` para um endpoint de API (lookup table)
- Incluir dados brutos relevantes no `rawData`

```typescript
function processComplianceRules(
  rawData: Record<string, unknown>,
  rules: ComplianceRule[]
): ComplianceResult {
  // Mapeamento de source_key para endpoint de API
  const sourceKeyToEndpoint: Record<string, string> = {
    // FortiGate
    'system_global': '/api/v2/cmdb/system/global',
    'system_interface': '/api/v2/cmdb/system/interface',
    'system_status': '/api/v2/monitor/system/status',
    'firewall_policy': '/api/v2/cmdb/firewall/policy',
    'vpn_ipsec': '/api/v2/cmdb/vpn.ipsec/phase1-interface',
    'log_settings': '/api/v2/cmdb/log/setting',
    // SonicWall
    'version': '/api/sonicos/version',
    'interfaces': '/api/sonicos/interfaces/ipv4',
    'zones': '/api/sonicos/zones',
    'access_rules': '/api/sonicos/access-rules/ipv4',
    // Genérico
    'default': 'API do dispositivo'
  };

  for (const rule of rules) {
    const logic = rule.evaluation_logic;
    const sourceData = rawData[logic.source_key];
    
    // ... avaliação existente ...
    
    // Gerar evidências automaticamente
    const evidence: Array<{ label: string; value: string; type: 'text' | 'code' }> = [];
    
    if (value !== undefined && value !== null) {
      evidence.push({
        label: rule.name,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        type: typeof value === 'object' ? 'code' : 'text'
      });
    }
    
    // Mapear endpoint
    const apiEndpoint = sourceKeyToEndpoint[logic.source_key] || sourceKeyToEndpoint['default'];
    
    // Incluir dados brutos relevantes (apenas o campo avaliado, não todo o sourceData)
    const checkRawData: Record<string, unknown> = {};
    if (logic.field_path && sourceData) {
      checkRawData[logic.field_path] = value;
    }
    
    checks.push({
      id: rule.code,
      name: rule.name,
      description,
      category: rule.category,
      severity: rule.severity,
      status,
      details,
      recommendation: status !== 'pass' ? (rule.recommendation || undefined) : undefined,
      weight: rule.weight,
      evidence: evidence.length > 0 ? evidence : undefined,
      rawData: Object.keys(checkRawData).length > 0 ? checkRawData : undefined,
      apiEndpoint,
    });
  }
  
  // ... resto da função ...
}
```

---

## Parte 2: Restrição de Visualização no Frontend

### Arquivo: `src/components/ComplianceCard.tsx`

#### 2.1. Importar o hook `useAuth` e verificar permissões

```typescript
import { useAuth } from '@/contexts/AuthContext';

export function ComplianceCard({ check, onClick }: ComplianceCardProps) {
  const { role } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Apenas super_admin e super_suporte podem ver evidências
  const canViewEvidence = role === 'super_admin' || role === 'super_suporte';
  
  // Ajustar lógica de evidências disponíveis
  const hasEvidence = canViewEvidence && check.evidence && check.evidence.length > 0;
  
  // ... resto do componente ...
  
  {/* Evidências expandidas - apenas para admins */}
  {isExpanded && hasEvidence && canViewEvidence && (
    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
      {/* conteúdo existente */}
    </div>
  )}
}
```

---

## Resumo das Alterações

| Componente | Arquivo | Alteração |
|------------|---------|-----------|
| Edge Function | `supabase/functions/agent-task-result/index.ts` | Adicionar campos `evidence`, `rawData`, `apiEndpoint` aos checks |
| Frontend | `src/components/ComplianceCard.tsx` | Verificar role do usuário antes de exibir evidências |

## Benefícios

- **Compatibilidade Universal**: Funciona para qualquer fabricante/modelo de firewall (FortiGate, SonicWall, futuros)
- **Segurança**: Dados técnicos sensíveis visíveis apenas para administradores autorizados
- **Manutenibilidade**: Evidências geradas automaticamente a partir das regras de compliance, sem hardcode
- **Escalabilidade**: Novos dispositivos/endpoints são mapeados facilmente no lookup table

## Dependências

- Nenhuma nova dependência necessária
- Utiliza o `useAuth` já existente no projeto
