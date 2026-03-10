import { AttackMap } from '@/components/firewall/AttackMap';
import { getCountryCode } from '@/lib/countryUtils';

interface EntraIdCountryMapProps {
  loginCountriesSuccess: { country: string; count: number }[];
  fullscreen?: boolean;
}

// Virtual destination point in Brazil to enable projectile animations
const ENTRA_ID_LOCATION = { lat: -14, lng: -51, label: 'Entra ID' };

export function EntraIdCountryMap({ loginCountriesSuccess, fullscreen = false }: EntraIdCountryMapProps) {
  // Normalize country data to ensure ISO2 codes work with AttackMap
  const normalizedCountries = loginCountriesSuccess.map(c => {
    const raw = c.country?.trim().toLowerCase();
    if (raw && raw.length === 2) {
      return { country: raw, count: c.count };
    }
    const iso2 = getCountryCode(c.country);
    return { country: iso2 || c.country, count: c.count };
  });

  return (
    <AttackMap
      authFailedCountries={[]}
      authSuccessCountries={normalizedCountries}
      firewallLocation={ENTRA_ID_LOCATION}
      fullscreen={fullscreen}
      hideLegend
      labelMap={{
        authSuccess: 'Login com Sucesso',
      }}
    />
  );
}
