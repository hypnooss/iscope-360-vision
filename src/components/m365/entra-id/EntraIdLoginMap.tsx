import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AttackMap } from '@/components/firewall/AttackMap';
import { AttackMapFullscreen } from '@/components/firewall/AttackMapFullscreen';
import { Maximize2, MapPin } from 'lucide-react';

interface EntraIdLoginMapProps {
  loginCountriesSuccess: { country: string; count: number }[];
  loginCountriesFailed: { country: string; count: number }[];
}

export function EntraIdLoginMap({ loginCountriesSuccess, loginCountriesFailed }: EntraIdLoginMapProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const hasData = loginCountriesSuccess.length > 0 || loginCountriesFailed.length > 0;
  if (!hasData) return null;

  const totalSuccess = loginCountriesSuccess.reduce((s, c) => s + c.count, 0);
  const totalFailed = loginCountriesFailed.reduce((s, c) => s + c.count, 0);

  return (
    <>
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Mapa de Origens de Login</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setFullscreen(true)} title="Tela cheia">
            <Maximize2 className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <AttackMap
            authFailedCountries={loginCountriesFailed}
            authSuccessCountries={loginCountriesSuccess}
          />
          <div className="flex items-center gap-4 justify-center py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#22c55e' }} />
              Login com Sucesso ({totalSuccess.toLocaleString()})
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#dc2626' }} />
              Login com Falha ({totalFailed.toLocaleString()})
            </div>
          </div>
        </CardContent>
      </Card>

      {fullscreen && (
        <AttackMapFullscreen
          authFailedCountries={loginCountriesFailed}
          authSuccessCountries={loginCountriesSuccess}
          totalFwAuthFailed={totalFailed}
          totalFwAuthSuccess={totalSuccess}
          firewallName="Entra ID — Origens de Login"
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
}
