

# Plano: Adicionar Ícones de Bandeira nos Sheets de Tráfego

## Contexto
Substituir as badges de país por ícones de bandeira usando a biblioteca `flag-icons` já instalada no projeto.

## Mudanças em `AnalyzerCategorySheet.tsx`

### 1. Adicionar imports
```typescript
import { getCountryCode } from '@/lib/countryUtils';
import 'flag-icons/css/flag-icons.min.css';
```

### 2. Atualizar componente `IPList`
Substituir a `<Badge>` pelo ícone de bandeira:
```tsx
{item.country && (
  <span className={`fi fi-${getCountryCode(item.country) || 'xx'} text-base shrink-0`} title={item.country} />
)}
```

### 3. Atualizar componente `CountryList`
Adicionar bandeira antes do nome do país:
```tsx
<span className="flex items-center gap-2">
  <span className={`fi fi-${getCountryCode(item.country) || 'xx'} text-base`} title={item.country} />
  <span className="text-sm">{item.country}</span>
</span>
```

## Arquivo modificado
- `src/components/firewall/AnalyzerCategorySheet.tsx`

