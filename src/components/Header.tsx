import { LogIn } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import logoPrecisio from '@/assets/logo-precisio-analytics.png';

export function Header() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logoPrecisio} alt="Precisio Analytics" className="h-10 w-auto" />
          <h1 className="text-lg font-bold text-foreground">InfraScope 360</h1>
        </div>

        <Button onClick={() => navigate('/auth')} className="gap-2">
          <LogIn className="w-4 h-4" />
          Acessar Plataforma
        </Button>
      </div>
    </header>
  );
}
