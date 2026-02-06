

# Plano: Corrigir Bandeiras de Países no ORIGEM AUTH

## Problema Identificado

O Microsoft Graph API retorna o **nome completo do país** em `location.countryOrRegion` (ex: "Brazil", "United States"), mas a função `getCountryFlag` espera um **código ISO de 2 letras** (ex: "BR", "US").

Por isso as bandeiras não estão aparecendo - a função não encontra match e retorna o globo genérico 🌍, ou os dados estão chegando como código mas sem correspondência.

---

## Solução

### 1. Criar mapeamento completo de nome para código ISO

Adicionar um mapa de conversão de nomes de países (como retornado pelo Graph) para códigos ISO:

```tsx
// Mapear nome do país → código ISO
function normalizeCountryCode(country: string): string {
  // Se já é código ISO de 2 letras
  if (country.length === 2 && /^[A-Z]{2}$/i.test(country)) {
    return country.toUpperCase();
  }
  
  // Mapa de nomes comuns → códigos ISO
  const nameToCode: Record<string, string> = {
    'brazil': 'BR',
    'brasil': 'BR',
    'united states': 'US',
    'usa': 'US',
    'portugal': 'PT',
    'united kingdom': 'GB',
    'germany': 'DE',
    'deutschland': 'DE',
    'france': 'FR',
    'spain': 'ES',
    'españa': 'ES',
    'italy': 'IT',
    'italia': 'IT',
    'netherlands': 'NL',
    'canada': 'CA',
    'australia': 'AU',
    'japan': 'JP',
    'china': 'CN',
    'india': 'IN',
    'mexico': 'MX',
    'méxico': 'MX',
    'argentina': 'AR',
    'chile': 'CL',
    'colombia': 'CO',
    'peru': 'PE',
    'perú': 'PE',
    // ... mais países conforme necessário
  };
  
  return nameToCode[country.toLowerCase()] || country.slice(0, 2).toUpperCase();
}
```

### 2. Atualizar função getCountryFlag

```tsx
function getCountryFlag(countryInput: string): string {
  // Normalizar para código ISO
  const code = normalizeCountryCode(countryInput);
  
  const flags: Record<string, string> = {
    'BR': '🇧🇷', 'US': '🇺🇸', 'PT': '🇵🇹', 'GB': '🇬🇧', 'UK': '🇬🇧',
    'DE': '🇩🇪', 'FR': '🇫🇷', 'ES': '🇪🇸', 'IT': '🇮🇹', 'NL': '🇳🇱',
    'CA': '🇨🇦', 'AU': '🇦🇺', 'JP': '🇯🇵', 'CN': '🇨🇳', 'IN': '🇮🇳',
    'MX': '🇲🇽', 'AR': '🇦🇷', 'CL': '🇨🇱', 'CO': '🇨🇴', 'PE': '🇵🇪',
  };
  
  return flags[code] || '🌍';
}
```

### 3. (Alternativa) Usar biblioteca de bandeiras via Unicode

Os emojis de bandeira são formados por **Regional Indicator Symbols**. Podemos gerar dinamicamente:

```tsx
function getCountryFlag(countryCode: string): string {
  const code = normalizeCountryCode(countryCode);
  
  // Converter código ISO para emoji de bandeira
  // 'BR' → 🇧🇷 (B=127463, R=127479)
  if (code.length === 2) {
    const codePoints = [...code.toUpperCase()].map(
      char => 0x1F1E6 - 65 + char.charCodeAt(0)
    );
    return String.fromCodePoint(...codePoints);
  }
  
  return '🌍';
}
```

Este método gera bandeiras para **qualquer** país automaticamente!

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/m365/M365PostureReportPage.tsx` | Atualizar `getCountryFlag` para normalizar nomes de países e gerar bandeiras dinamicamente |

---

## Resultado Esperado

```
ORIGEM AUTH    🇧🇷 🇺🇸 🇵🇹 🇩🇪 🇫🇷
```

Com a solução de Unicode dinâmico, qualquer código de país será convertido automaticamente para sua bandeira correspondente.

