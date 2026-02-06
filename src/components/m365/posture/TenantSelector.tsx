import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Tenant {
  id: string;
  displayName: string;
  domain: string;
}

interface TenantSelectorProps {
  tenants: Tenant[];
  selectedId: string | null;
  onSelect: (tenantId: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function TenantSelector({
  tenants,
  selectedId,
  onSelect,
  loading = false,
  disabled = false,
}: TenantSelectorProps) {
  const selectedTenant = tenants.find((t) => t.id === selectedId);

  if (tenants.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Building2 className="w-4 h-4" />
        <span>Nenhum tenant conectado</span>
      </div>
    );
  }

  if (tenants.length === 1) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <div>
          <span className="font-medium text-foreground">
            {selectedTenant?.displayName || 'Tenant'}
          </span>
          {selectedTenant?.domain && (
            <span className="text-sm text-muted-foreground ml-2">
              ({selectedTenant.domain})
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || loading}>
        <Button
          variant="outline"
          className="flex items-center gap-2 h-auto py-2 px-3"
          disabled={disabled || loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Building2 className="w-4 h-4" />
          )}
          <div className="flex flex-col items-start">
            <span className="font-medium">
              {selectedTenant?.displayName || 'Selecionar Tenant'}
            </span>
            {selectedTenant?.domain && (
              <span className="text-xs text-muted-foreground">
                {selectedTenant.domain}
              </span>
            )}
          </div>
          <ChevronDown className="w-4 h-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        {tenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onClick={() => onSelect(tenant.id)}
            className={cn(
              'flex items-center justify-between cursor-pointer',
              tenant.id === selectedId && 'bg-accent'
            )}
          >
            <div className="flex flex-col">
              <span className="font-medium">{tenant.displayName}</span>
              {tenant.domain && (
                <span className="text-xs text-muted-foreground">
                  {tenant.domain}
                </span>
              )}
            </div>
            {tenant.id === selectedId && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
