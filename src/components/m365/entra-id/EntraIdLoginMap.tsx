import { useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { EntraIdCountryMap } from './EntraIdCountryMap';

interface EntraIdLoginMapProps {
  loginCountriesSuccess: { country: string; count: number }[];
  loginCountriesFailed?: { country: string; count: number }[];
}

export function EntraIdLoginMap({ loginCountriesSuccess }: EntraIdLoginMapProps) {
  const [fullscreen, setFullscreen] = useState(false);

  if (loginCountriesSuccess.length === 0) return null;

  const totalSuccess = loginCountriesSuccess.reduce((s, c) => s + c.count, 0);

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Mapa de Conexões
          </h2>
          <button
            onClick={() => setFullscreen(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Tela cheia
          </button>
        </div>

        <div
          className="max-h-[200px] overflow-hidden rounded-lg border border-border/50 cursor-pointer"
          onClick={() => setFullscreen(true)}
        >
          <EntraIdCountryMap loginCountriesSuccess={loginCountriesSuccess} />
        </div>

        <div className="flex items-center gap-4 justify-center mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block bg-primary" />
            Login com Sucesso ({totalSuccess.toLocaleString()})
          </div>
        </div>
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              Entra ID — Origens de Login
            </h2>
            <button
              onClick={() => setFullscreen(false)}
              className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 relative">
            <EntraIdCountryMap loginCountriesSuccess={loginCountriesSuccess} fullscreen />
          </div>
          <div className="flex items-center gap-4 justify-center p-3 border-t border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: 'hsl(142, 71%, 45%)' }} />
              Login com Sucesso ({totalSuccess.toLocaleString()})
            </div>
          </div>
        </div>
      )}
    </>
  );
}
