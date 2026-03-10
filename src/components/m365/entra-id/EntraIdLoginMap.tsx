import { useState } from 'react';
import { AttackMap } from '@/components/firewall/AttackMap';
import { AttackMapFullscreen } from '@/components/firewall/AttackMapFullscreen';
import { Maximize2 } from 'lucide-react';

interface EntraIdLoginMapProps {
  loginCountriesSuccess: { country: string; count: number }[];
  loginCountriesFailed: { country: string; count: number }[];
}

const ENTRA_LOCATION = { lat: -15.8, lng: -47.9, label: 'Entra ID' };

const ENTRA_LABEL_MAP = {
  authFailed: 'Login com Falha',
  authSuccess: 'Login com Sucesso',
  centerPoint: 'Entra ID',
};

export function EntraIdLoginMap({ loginCountriesSuccess, loginCountriesFailed }: EntraIdLoginMapProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const hasData = loginCountriesSuccess.length > 0 || loginCountriesFailed.length > 0;
  if (!hasData) return null;

  const totalSuccess = loginCountriesSuccess.reduce((s, c) => s + c.count, 0);
  const totalFailed = loginCountriesFailed.reduce((s, c) => s + c.count, 0);

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
          <AttackMap
            authFailedCountries={loginCountriesFailed}
            authSuccessCountries={loginCountriesSuccess}
            firewallLocation={ENTRA_LOCATION}
            hideLegend
            labelMap={ENTRA_LABEL_MAP}
          />
        </div>

        <div className="flex items-center gap-4 justify-center mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: 'hsl(142, 71%, 45%)' }} />
            Login com Sucesso ({totalSuccess.toLocaleString()})
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: 'hsl(0, 72%, 51%)' }} />
            Login com Falha ({totalFailed.toLocaleString()})
          </div>
        </div>
      </div>

      {fullscreen && (
        <AttackMapFullscreen
          authFailedCountries={loginCountriesFailed}
          authSuccessCountries={loginCountriesSuccess}
          totalFwAuthFailed={totalFailed}
          totalFwAuthSuccess={totalSuccess}
          firewallLocation={ENTRA_LOCATION}
          firewallName="Entra ID — Origens de Login"
          labelMap={ENTRA_LABEL_MAP}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
}
