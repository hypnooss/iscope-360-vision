
# Plano: Barra Bicolor e Sheet com Abas para Autenticação Firewall

## Mudanças

### 1. Grid - Barra Bicolor para Autenticação (`AnalyzerCategoryGrid.tsx`)

Adicionar lógica para renderizar barra bicolor quando categoria tiver `success`/`failed`:

```tsx
const hasAuthSplit = stats.success !== undefined && stats.failed !== undefined;

// Na renderização da barra:
{hasAuthSplit && hasData ? (
  <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden flex">
    <div className="h-full bg-red-500" style={{ width: `${(stats.failed! / stats.total) * 100}%` }} />
    <div className="h-full bg-green-500" style={{ width: `${(stats.success! / stats.total) * 100}%` }} />
  </div>
) : hasTrafficSplit && hasData ? (
  // ... barra de tráfego existente
) : (
  // ... barra de severidade existente
)}
```

### 2. Sheet - Tabs "Sucesso/Falha" com Bandeiras e IPs Privados (`AnalyzerCategorySheet.tsx`)

**Helper para detectar IP privado:**
```typescript
const isPrivateIP = (ip: string) =>
  /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/.test(ip);
```

**Atualizar `IPList` para mostrar ícone de LAN para IPs privados:**
```tsx
{item.country ? (
  <span className={`fi fi-${getCountryCode(item.country)}`} title={item.country} />
) : isPrivateIP(item.ip) ? (
  <Server className="w-4 h-4 text-muted-foreground" title="IP Privado (LAN)" />
) : null}
```

**Criar `renderFwAuthContent()` com estrutura de Tabs:**
- Aba "Falha" (default): `topFwAuthIPsFailed`, `topFwAuthCountriesFailed`
- Aba "Sucesso": `topFwAuthIPsSuccess`, `topFwAuthCountriesSuccess`

Usar mesmo padrão visual do tráfego (Separator + TabsList + TabsContent com ScrollArea).

## Arquivos Modificados
- `src/components/firewall/AnalyzerCategoryGrid.tsx` - Barra bicolor para auth
- `src/components/firewall/AnalyzerCategorySheet.tsx` - Tabs + bandeiras + IPs privados
