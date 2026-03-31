import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const AVAILABLE_SCOPES = [
  { value: 'external_domain:read', label: 'Domínios: Leitura', description: 'Listar domínios e status' },
  { value: 'external_domain:write', label: 'Domínios: Cadastro', description: 'Cadastrar novos domínios no workspace' },
  { value: 'external_domain:report', label: 'Domínios: Relatório', description: 'Obter relatório de análise completo' },
  { value: 'external_domain:analyze', label: 'Domínios: Análise', description: 'Disparar nova análise' },
  { value: 'external_domain:subdomains', label: 'Domínios: Subdomínios', description: 'Listar subdomínios enumerados' },
  { value: 'external_domain:certificates', label: 'Domínios: Certificados', description: 'Dados de certificados SSL/TLS' },
];

interface ApiKeyScopesSelectProps {
  selected: string[];
  onChange: (scopes: string[]) => void;
}

export function ApiKeyScopesSelect({ selected, onChange }: ApiKeyScopesSelectProps) {
  const toggle = (scope: string) => {
    onChange(
      selected.includes(scope)
        ? selected.filter((s) => s !== scope)
        : [...selected, scope]
    );
  };

  const selectAll = () => {
    if (selected.length === AVAILABLE_SCOPES.length) {
      onChange([]);
    } else {
      onChange(AVAILABLE_SCOPES.map((s) => s.value));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="select-all-scopes"
          checked={selected.length === AVAILABLE_SCOPES.length}
          onCheckedChange={selectAll}
        />
        <Label htmlFor="select-all-scopes" className="text-sm font-medium cursor-pointer">
          Selecionar todos
        </Label>
      </div>
      <div className="grid gap-2 pl-2">
        {AVAILABLE_SCOPES.map((scope) => (
          <div key={scope.value} className="flex items-start gap-2">
            <Checkbox
              id={scope.value}
              checked={selected.includes(scope.value)}
              onCheckedChange={() => toggle(scope.value)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor={scope.value} className="text-sm cursor-pointer">{scope.label}</Label>
              <p className="text-xs text-muted-foreground">{scope.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
