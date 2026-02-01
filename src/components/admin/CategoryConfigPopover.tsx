import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Loader2 } from 'lucide-react';
import { 
  AVAILABLE_ICONS, 
  AVAILABLE_COLORS, 
  useUpsertCategoryConfig,
  getCategoryConfig,
  type CategoryConfig,
} from '@/hooks/useCategoryConfig';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

interface CategoryConfigPopoverProps {
  categoryName: string;
  deviceTypeId: string;
  configs: CategoryConfig[] | undefined;
  onSaved?: () => void;
}

// Dynamic icon component
function DynamicIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const iconName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') as keyof typeof LucideIcons;
  
  const IconComponent = LucideIcons[iconName] as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  
  if (!IconComponent) {
    return <LucideIcons.Shield className={className} style={style} />;
  }
  
  return <IconComponent className={className} style={style} />;
}

export function CategoryConfigPopover({ 
  categoryName, 
  deviceTypeId,
  configs,
  onSaved 
}: CategoryConfigPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentConfig = getCategoryConfig(configs, categoryName);
  
  const [displayName, setDisplayName] = useState(currentConfig.displayName);
  const [icon, setIcon] = useState(currentConfig.icon);
  const [color, setColor] = useState(currentConfig.color);

  const upsertMutation = useUpsertCategoryConfig();

  // Reset form when popover opens
  useEffect(() => {
    if (isOpen) {
      const config = getCategoryConfig(configs, categoryName);
      setDisplayName(config.displayName);
      setIcon(config.icon);
      setColor(config.color);
    }
  }, [isOpen, configs, categoryName]);

  const handleSave = async () => {
    await upsertMutation.mutateAsync({
      device_type_id: deviceTypeId,
      name: categoryName,
      display_name: displayName !== categoryName ? displayName : null,
      icon,
      color,
    });
    setIsOpen(false);
    onSaved?.();
  };

  const selectedColor = AVAILABLE_COLORS.find(c => c.name === color);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-50 hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80" 
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Configurar Categoria</h4>
            <p className="text-sm text-muted-foreground">
              Personalize a aparência desta categoria nos relatórios.
            </p>
          </div>
          
          <div className="grid gap-3">
            {/* Display Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="displayName">Nome de Exibição</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={categoryName}
              />
            </div>

            {/* Icon Selection */}
            <div className="grid gap-1.5">
              <Label>Ícone</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <DynamicIcon name={icon} className="h-4 w-4" />
                      <span>{AVAILABLE_ICONS.find(i => i.name === icon)?.label || icon}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ICONS.map((iconOption) => (
                    <SelectItem key={iconOption.name} value={iconOption.name}>
                      <div className="flex items-center gap-2">
                        <DynamicIcon name={iconOption.name} className="h-4 w-4" />
                        <span>{iconOption.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color Selection */}
            <div className="grid gap-1.5">
              <Label>Cor</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-4 w-4 rounded-full border border-border"
                        style={{ backgroundColor: selectedColor?.hex }}
                      />
                      <span>{selectedColor?.label || color}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_COLORS.map((colorOption) => (
                    <SelectItem key={colorOption.name} value={colorOption.name}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-4 w-4 rounded-full border border-border"
                          style={{ backgroundColor: colorOption.hex }}
                        />
                        <span>{colorOption.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border p-3">
            <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
            <div 
              className={cn(
                "flex items-center gap-2 p-2 rounded-md border-l-4",
                `border-l-[${selectedColor?.hex}]`
              )}
              style={{ 
                borderLeftColor: selectedColor?.hex,
                backgroundColor: `${selectedColor?.hex}10`
              }}
            >
              <DynamicIcon 
                name={icon} 
                className="h-5 w-5" 
                style={{ color: selectedColor?.hex }}
              />
              <span 
                className="font-semibold"
                style={{ color: selectedColor?.hex }}
              >
                {displayName}
              </span>
            </div>
          </div>

          {/* Save Button */}
          <Button 
            onClick={handleSave}
            disabled={upsertMutation.isPending}
          >
            {upsertMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
