import { useEffect } from 'react';
import { AttackMap } from './AttackMap';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { getCountryCode } from '@/lib/countryUtils';
import type { TopCountry, TopBlockedIP } from '@/types/analyzerInsights';
import 'flag-icons/css/flag-icons.min.css';

interface AttackMapFullscreenProps {
  deniedCountries: TopCountry[];
  authFailedCountries: TopCountry[];
  authSuccessCountries: TopCountry[];
  firewallLocation?: { lat: number; lng: number; label: string };
  firewallName?: string;
  lastAnalysis?: string;
  totalDenied?: number;
  totalAuthFailed?: number;
  totalAuthSuccess?: number;
  topBlockedIPs?: TopBlockedIP[];
  onClose: () => void;
}

export function AttackMapFullscreen({
  deniedCountries,
  authFailedCountries,
  authSuccessCountries,
  firewallLocation,
  firewallName,
  lastAnalysis,
  totalDenied = 0,
  totalAuthFailed = 0,
  totalAuthSuccess = 0,
  topBlockedIPs = [],
  onClose,
}: AttackMapFullscreenProps) {
  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Merge all countries and sort for top 3
  const allAttackCountries = [...deniedCountries, ...authFailedCountries]
    .reduce<TopCountry[]>((acc, c) => {
      const existing = acc.find(a => a.country === c.country);
      if (existing) existing.count += c.count;
      else acc.push({ ...c });
      return acc;
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 bg-black animate-fade-in flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
        <Button
          variant="ghost"
          onClick={onClose}
          className="text-white/80 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-center gap-3">
          {firewallName && (
            <span className="text-white/70 text-sm font-medium">{firewallName}</span>
          )}
          {lastAnalysis && (
            <span className="text-white/40 text-xs">
              {new Date(lastAnalysis).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Map fills the screen */}
      <div className="flex-1 w-full h-full">
        <AttackMap
          deniedCountries={deniedCountries}
          authFailedCountries={authFailedCountries}
          authSuccessCountries={authSuccessCountries}
          firewallLocation={firewallLocation}
          fullscreen
        />
      </div>

      {/* Right panel - Top attack origins */}
      <div className="absolute top-20 right-4 z-20 w-56 bg-black/70 backdrop-blur-md rounded-lg border border-white/10 p-4">
        <h3 className="text-white/90 text-xs font-semibold uppercase tracking-wider mb-3">
          Top Origens de Ataque
        </h3>
        <div className="space-y-2">
          {allAttackCountries.map((c, i) => {
            const code = getCountryCode(c.country);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-white/40 text-xs font-bold w-4">{i + 1}</span>
                {code && <span className={`fi fi-${code} text-sm`} />}
                <span className="text-white/80 text-sm flex-1 truncate">{c.country}</span>
                <span className="text-white/60 text-xs font-mono">{c.count.toLocaleString()}</span>
              </div>
            );
          })}
        </div>

        {topBlockedIPs.length > 0 && (
          <>
            <div className="border-t border-white/10 my-3" />
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-wider mb-3">
              Top IPs Bloqueados
            </h3>
            <div className="space-y-2">
              {topBlockedIPs.slice(0, 3).map((ip, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-white/40 text-xs font-bold w-4">{i + 1}</span>
                  <span className="text-white/80 text-xs font-mono flex-1 truncate">{ip.ip}</span>
                  <span className="text-white/60 text-xs font-mono">{ip.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom stats bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/70 backdrop-blur-md border-t border-white/10 px-6 py-3">
        <div className="flex items-center justify-center gap-8 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            <span className="text-white/60 text-xs">Tráfego Negado</span>
            <span className="text-white font-bold text-sm">{totalDenied.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500 inline-block shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
            <span className="text-white/60 text-xs">Falha Auth</span>
            <span className="text-white font-bold text-sm">{totalAuthFailed.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="text-white/60 text-xs">Sucesso Auth</span>
            <span className="text-white font-bold text-sm">{totalAuthSuccess.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block shadow-[0_0_8px_rgba(6,182,212,0.6)]" style={{ backgroundColor: '#06b6d4' }} />
            <span className="text-white/60 text-xs">Firewall</span>
          </div>
        </div>
      </div>
    </div>
  );
}
