

# Plano: Exibir Contagem de Autenticações por País (Sucesso/Falha)

## Objetivo

Alterar a exibição de "Origem Auth" para mostrar as quantidades de autenticações bem-sucedidas e falhas por país:

**Formato esperado:**
```
🇧🇷 Brasil (150/12), 🇺🇸 Estados Unidos (45/3), 🇱🇺 Luxemburgo (20/0)
```

Onde: `(sucesso/falha)`

---

## Alterações Necessárias

### 1. Edge Function: Modificar estrutura de dados

**Arquivo:** `supabase/functions/m365-security-posture/index.ts`

Alterar a interface e a coleta para separar sucesso e falha:

```typescript
// Antes (linha 78)
loginCountries: Array<{ country: string; count: number }>;

// Depois
loginCountries: Array<{ country: string; success: number; fail: number }>;
```

Modificar a lógica de coleta (linhas 201-224):

```typescript
// Antes: busca apenas location
'/auditLogs/signIns?$select=location&$top=500'

// Depois: busca location + status
'/auditLogs/signIns?$select=location,status&$top=500'
```

E a contagem:

```typescript
// Antes
const countries = new Map<string, number>();
signIns.value.forEach((s: any) => {
  const country = s.location?.countryOrRegion;
  if (country) {
    countries.set(country, (countries.get(country) || 0) + 1);
  }
});

// Depois
const countries = new Map<string, { success: number; fail: number }>();
signIns.value.forEach((s: any) => {
  const country = s.location?.countryOrRegion;
  if (country) {
    const current = countries.get(country) || { success: 0, fail: 0 };
    // errorCode 0 = sucesso, qualquer outro = falha
    if (s.status?.errorCode === 0) {
      current.success++;
    } else {
      current.fail++;
    }
    countries.set(country, current);
  }
});
```

---

### 2. Frontend: Atualizar exibição

**Arquivo:** `src/pages/m365/M365PostureReportPage.tsx`

Atualizar a renderização da Origem Auth (linhas 684-704):

```tsx
<DetailRow 
  label="Origem Auth" 
  value={envMetrics.loginCountries && envMetrics.loginCountries.length > 0 
    ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {envMetrics.loginCountries.slice(0, 5).map((c, idx) => {
          const code = normalizeCountryCode(c.country);
          const name = getCountryName(code || c.country);
          const flagCode = code.toLowerCase();
          // Formato: [flag] Nome (sucesso/falha)
          return (
            <span key={idx} className="inline-flex items-center gap-1.5">
              <span className={`fi fi-${flagCode} rounded-sm`} style={{ fontSize: '1rem' }} />
              <span>{name}</span>
              <span className="text-muted-foreground text-xs">
                ({c.success}/{c.fail})
              </span>
            </span>
          );
        })}
      </div>
    )
    : 'N/A'
  }
/>
```

---

### 3. Atualizar tipos TypeScript (se necessário)

**Arquivo:** `src/types/m365Insights.ts` (verificar se existe definição)

Garantir que o tipo reflita a nova estrutura:

```typescript
interface EnvironmentMetrics {
  // ... outros campos
  loginCountries: Array<{ 
    country: string; 
    success: number; 
    fail: number; 
  }>;
}
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/m365-security-posture/index.ts` | Alterar estrutura de loginCountries para incluir success/fail |
| `src/pages/m365/M365PostureReportPage.tsx` | Atualizar exibição para mostrar `(sucesso/falha)` |
| `src/types/m365Insights.ts` | Atualizar interface (se aplicável) |

---

## Resultado Visual Esperado

```
ORIGEM AUTH    🇧🇷 Brasil (150/12), 🇺🇸 Estados Unidos (45/3), 🇱🇺 Luxemburgo (20/0)
```

- Primeiro número: autenticações bem-sucedidas
- Segundo número: tentativas falhas
- Ordenação mantida pelo total (sucesso + falha) decrescente

---

## Detalhes Técnicos

### Inicialização da estrutura (edge function)

```typescript
loginCountries: [],  // Array<{ country: string; success: number; fail: number }>
```

### Ordenação por total

```typescript
metrics.loginCountries = Array.from(countries.entries())
  .map(([country, counts]) => ({ country, success: counts.success, fail: counts.fail }))
  .sort((a, b) => (b.success + b.fail) - (a.success + a.fail))
  .slice(0, 5);
```

### Backward Compatibility

Para garantir compatibilidade com dados antigos que já estão no banco, o frontend pode verificar:

```tsx
// Se ainda existir o formato antigo (só count), exibir só o count
const hasNewFormat = typeof c.success === 'number';
if (hasNewFormat) {
  return `(${c.success}/${c.fail})`;
} else {
  return `(${c.count || 0})`;  // fallback para formato antigo
}
```

