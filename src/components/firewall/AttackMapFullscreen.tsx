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
  authFailedVpnCountries?: TopCountry[];
  authSuccessCountries: TopCountry[];
  outboundCountries?: TopCountry[];
  firewallLocation?: { lat: number; lng: number; label: string };
  firewallName?: string;
  lastAnalysis?: string;
  totalDenied?: number;
  totalFwAuthFailed?: number;
  totalVpnAuthFailed?: number;
  totalAuthSuccess?: number;
  totalOutbound?: number;
  topBlockedIPs?: TopBlockedIP[];
  topOutboundCountries?: TopCountry[];
  onClose: () => void;
}

export function AttackMapFullscreen({
  deniedCountries,
  authFailedCountries,
  authFailedVpnCountries = [],
  authSuccessCountries,
  outboundCountries = [],
  firewallLocation,
  firewallName,
  lastAnalysis,
  totalDenied = 0,
  totalFwAuthFailed = 0,
  totalVpnAuthFailed = 0,
  totalAuthSuccess = 0,
  totalOutbound = 0,
  topBlockedIPs = [],
  topOutboundCountries = [],
  onClose,
}: AttackMapFullscreenProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Merge denied + FW fail + VPN fail for top attack origins
  const allAttackCountries = [...deniedCountries, ...authFailedCountries, ...authFailedVpnCountries]
    .reduce<TopCountry[]>((acc, c) => {
      const existing = acc.find(a => a.country === c.country);
      if (existing) existing.count += c.count;
      else acc.push({ ...c });
      return acc;
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topOutbound = topOutboundCountries.slice(0, 5);

  return (
    <div className="fixed inset-0 z-[9999] animate-fade-in flex flex-col" style={{ background: '#222222' }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between px-6 py-4">
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

      {/* Map */}
      <div className="flex-1 w-full min-h-0">
        <AttackMap
          deniedCountries={deniedCountries}
          authFailedCountries={authFailedCountries}
          authFailedVpnCountries={authFailedVpnCountries}
          authSuccessCountries={authSuccessCountries}
          outboundCountries={outboundCountries}
          firewallLocation={firewallLocation}
          fullscreen={true}
        />
      </div>

      {/* Right panel - Top attack origins + Top outbound */}
      <div className="absolute top-20 right-4 z-[1000] w-60 bg-black/70 backdrop-blur-md rounded-lg border border-white/10 p-4 space-y-4">
        <div>
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
        </div>

        {topOutbound.length > 0 && (
          <div>
            <div className="border-t border-white/10 mb-3" />
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-wider mb-3">
              Top Destinos (Saída)
            </h3>
            <div className="space-y-2">
              {topOutbound.map((c, i) => {
                const code = getCountryCode(c.country);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-white/40 text-xs font-bold w-4">{i + 1}</span>
                    {code && <span className={`fi fi-${code} text-sm`} />}
                    <span className="text-white/80 text-sm flex-1 truncate">{c.country}</span>
                    <span style={{ color: '#38bdf8' }} className="text-xs font-mono">{c.count.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {topBlockedIPs.length > 0 && (
          <div>
            <div className="border-t border-white/10 mb-3" />
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
          </div>
        )}
      </div>

      {/* Bottom stats bar */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-black/70 backdrop-blur-md border-t border-white/10 px-6 py-3">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.6)' }} />
            <span className="text-white/60 text-xs">Tráfego Negado</span>
            <span className="text-white font-bold text-sm">{totalDenied.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#f97316', boxShadow: '0 0 8px rgba(249,115,22,0.6)' }} />
            <span className="text-white/60 text-xs">Falha Auth FW</span>
            <span className="text-white font-bold text-sm">{totalFwAuthFailed.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#eab308', boxShadow: '0 0 8px rgba(234,179,8,0.6)' }} />
            <span className="text-white/60 text-xs">Falha Auth VPN</span>
            <span className="text-white font-bold text-sm">{totalVpnAuthFailed.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.6)' }} />
            <span className="text-white/60 text-xs">Sucesso Auth</span>
            <span className="text-white font-bold text-sm">{totalAuthSuccess.toLocaleString()}</span>
          </div>
          {totalOutbound > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#38bdf8', boxShadow: '0 0 8px rgba(56,189,248,0.6)' }} />
              <span className="text-white/60 text-xs">Conexões Saída</span>
              <span className="text-white font-bold text-sm">{totalOutbound.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#06b6d4', boxShadow: '0 0 8px rgba(6,182,212,0.6)' }} />
            <span className="text-white/60 text-xs">Firewall</span>
          </div>
        </div>
      </div>
    </div>
  );
}
