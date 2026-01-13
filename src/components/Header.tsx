import { Settings, HelpCircle } from 'lucide-react';
import { Button } from './ui/button';
import logoPrecisio from '@/assets/logo-precisio-analytics.png';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logoPrecisio} alt="Precisio Analytics" className="h-10 w-auto" />
          <div>
            <h1 className="text-lg font-bold text-foreground">InfraScope 360</h1>
            <p className="text-xs text-muted-foreground">Gestão de Infraestrutura</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <HelpCircle className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
