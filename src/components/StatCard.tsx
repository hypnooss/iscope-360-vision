import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant: 'success' | 'destructive' | 'warning' | 'default';
  delay?: number;
}

const variantStyles = {
  success: 'border-success/30 bg-success/5',
  destructive: 'border-destructive/30 bg-destructive/5',
  warning: 'border-warning/30 bg-warning/5',
  default: 'border-primary/30 bg-primary/5',
};

const iconStyles = {
  success: 'text-success bg-success/10',
  destructive: 'text-destructive bg-destructive/10',
  warning: 'text-warning bg-warning/10',
  default: 'text-primary bg-primary/10',
};

const valueStyles = {
  success: 'text-success',
  destructive: 'text-destructive',
  warning: 'text-warning',
  default: 'text-primary',
};

export function StatCard({ title, value, icon: Icon, variant, delay = 0 }: StatCardProps) {
  return (
    <div 
      className={cn(
        "glass-card rounded-xl p-5 border animate-fade-in",
        variantStyles[variant]
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className={cn("text-3xl font-bold tabular-nums", valueStyles[variant])}>
            {value}
          </p>
        </div>
        <div className={cn("p-3 rounded-lg", iconStyles[variant])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
