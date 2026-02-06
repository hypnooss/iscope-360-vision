

# Plano: Exibir Nomes de Países por Extenso na Origem Auth

## Problema Identificado

Os emojis de bandeira (`🇧🇷`, `🇺🇸`) **não estão renderizando** neste ambiente - aparecem como texto "BR US LU PL RU". Isso pode ocorrer por:
- Fonte CSS que não suporta emojis de bandeira
- Sistema operacional sem suporte a Regional Indicator Symbols
- Alguma limitação do ambiente de renderização

## Solução

Exibir os **nomes completos dos países** (com ou sem bandeira), garantindo:
1. Nome por extenso (ex: "Brasil", "Estados Unidos")
2. Espaçamento adequado entre países múltiplos
3. Fallback robusto se bandeira não renderizar

## Alterações

### 1. Criar mapa de código ISO → nome do país

```tsx
function getCountryName(countryCode: string): string {
  const codeToName: Record<string, string> = {
    'BR': 'Brasil',
    'US': 'Estados Unidos',
    'PT': 'Portugal',
    'GB': 'Reino Unido',
    'DE': 'Alemanha',
    'FR': 'França',
    'ES': 'Espanha',
    'IT': 'Itália',
    'NL': 'Países Baixos',
    'CA': 'Canadá',
    'AU': 'Austrália',
    'JP': 'Japão',
    'CN': 'China',
    'IN': 'Índia',
    'MX': 'México',
    'AR': 'Argentina',
    'CL': 'Chile',
    'CO': 'Colômbia',
    'PE': 'Peru',
    'RU': 'Rússia',
    'PL': 'Polônia',
    'LU': 'Luxemburgo',
    // ... outros países
  };
  
  const code = countryCode.toUpperCase();
  return codeToName[code] || code; // Fallback para o código se não encontrar
}
```

### 2. Atualizar formatação da Origem Auth

```tsx
// Antes (linha 606-608)
value={envMetrics.loginCountries.slice(0, 5).map(c => getCountryFlag(c.country)).join(' ')}

// Depois - exibir bandeira + nome por extenso, separados por vírgula
value={envMetrics.loginCountries.slice(0, 5)
  .map(c => {
    const code = normalizeCountryCode(c.country);
    const flag = getCountryFlag(c.country);
    const name = getCountryName(code);
    return `${flag} ${name}`;
  })
  .join(', ')
}
```

### 3. Resultado Visual Esperado

```
ORIGEM AUTH    🇧🇷 Brasil, 🇺🇸 Estados Unidos, 🇱🇺 Luxemburgo, 🇵🇱 Polônia, 🇷🇺 Rússia
```

Se as bandeiras não renderizarem:
```
ORIGEM AUTH    Brasil, Estados Unidos, Luxemburgo, Polônia, Rússia
```

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/m365/M365PostureReportPage.tsx` | Adicionar `getCountryName()` e atualizar formatação da Origem Auth |

---

## Detalhes Técnicos

### Função getCountryName

Adicionar após a função `getCountryFlag` (linha ~235):

```tsx
function getCountryName(countryCode: string): string {
  const codeToName: Record<string, string> = {
    'BR': 'Brasil',
    'US': 'Estados Unidos',
    'PT': 'Portugal',
    'GB': 'Reino Unido',
    'UK': 'Reino Unido',
    'DE': 'Alemanha',
    'FR': 'França',
    'ES': 'Espanha',
    'IT': 'Itália',
    'NL': 'Países Baixos',
    'CA': 'Canadá',
    'AU': 'Austrália',
    'JP': 'Japão',
    'CN': 'China',
    'IN': 'Índia',
    'MX': 'México',
    'AR': 'Argentina',
    'CL': 'Chile',
    'CO': 'Colômbia',
    'PE': 'Peru',
    'RU': 'Rússia',
    'ZA': 'África do Sul',
    'IE': 'Irlanda',
    'CH': 'Suíça',
    'SE': 'Suécia',
    'NO': 'Noruega',
    'DK': 'Dinamarca',
    'FI': 'Finlândia',
    'BE': 'Bélgica',
    'AT': 'Áustria',
    'PL': 'Polônia',
    'CZ': 'Tchéquia',
    'KR': 'Coreia do Sul',
    'SG': 'Singapura',
    'HK': 'Hong Kong',
    'TW': 'Taiwan',
    'IL': 'Israel',
    'AE': 'Emirados Árabes',
    'SA': 'Arábia Saudita',
    'NZ': 'Nova Zelândia',
    'EG': 'Egito',
    'TR': 'Turquia',
    'GR': 'Grécia',
    'UA': 'Ucrânia',
    'RO': 'Romênia',
    'HU': 'Hungria',
    'TH': 'Tailândia',
    'VN': 'Vietnã',
    'PH': 'Filipinas',
    'ID': 'Indonésia',
    'MY': 'Malásia',
    'NG': 'Nigéria',
    'KE': 'Quênia',
    'MA': 'Marrocos',
    'UY': 'Uruguai',
    'PY': 'Paraguai',
    'EC': 'Equador',
    'VE': 'Venezuela',
    'BO': 'Bolívia',
    'CR': 'Costa Rica',
    'PA': 'Panamá',
    'PR': 'Porto Rico',
    'DO': 'República Dominicana',
    'CU': 'Cuba',
    'GT': 'Guatemala',
    'HN': 'Honduras',
    'SV': 'El Salvador',
    'NI': 'Nicarágua',
    'JM': 'Jamaica',
    'LU': 'Luxemburgo',
  };
  
  const code = countryCode.toUpperCase();
  return codeToName[code] || code;
}
```

### Atualização da Origem Auth (linhas 604-610)

```tsx
<DetailRow 
  label="Origem Auth" 
  value={envMetrics.loginCountries && envMetrics.loginCountries.length > 0 
    ? envMetrics.loginCountries.slice(0, 5).map(c => {
        const code = normalizeCountryCode(c.country);
        const flag = getCountryFlag(c.country);
        const name = getCountryName(code || c.country);
        return `${flag} ${name}`;
      }).join(', ')
    : 'N/A'
  }
/>
```

---

## Consideração sobre Pack de Ícones

Não é necessário instalar um pack de ícones externo. O problema é que emojis de bandeira (Regional Indicator Symbols) dependem do sistema operacional e fonte do navegador. A solução de exibir o **nome por extenso** garante que a informação seja sempre legível, independentemente do suporte a emojis.

Se desejarmos garantir 100% de renderização das bandeiras no futuro, podemos considerar:
- **flag-icons** (biblioteca CSS com SVGs)
- **CDN de bandeiras** (flagcdn.com)

Mas para o momento, nome por extenso resolve o problema de usabilidade.

