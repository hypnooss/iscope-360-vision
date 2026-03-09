

# Plano: Card Eventos IPS com Abas Atacantes/Alvos + Top Ataques

## Resumo
Enriquecer o backend para gerar rankings de IPs atacantes, IPs alvo e tipos de ataque. No frontend, sheet com abas "Atacantes" e "Alvos", além de um card "Top Ataques" fixo no topo.

## 1. Backend - Edge Function `firewall-analyzer/index.ts`

Modificar `analyzeIPS()` para retornar métricas adicionais:

```typescript
metrics: {
  ipsEvents: logs.length,
  topIpsAttackTypes: TopCategory[],     // Top ataques por tipo (attack name + count)
  topIpsSrcIPs: TopBlockedIP[],         // Top IPs atacantes (srcip + country + count)
  topIpsSrcCountries: TopCountry[],     // Top países atacantes
  topIpsDstIPs: TopBlockedIP[],         // Top IPs alvo (dstip + count)
}
```

Lógica: agregar `srcip` com GeoIP lookup (mesmo padrão `rankIPs` usado em denied/outbound), agregar `dstip` como alvos internos, agregar `attack` como tipos.

## 2. Tipos - `analyzerInsights.ts`

Adicionar ao `AnalyzerMetrics`:
```typescript
topIpsAttackTypes: TopCategory[];
topIpsSrcIPs: TopBlockedIP[];
topIpsSrcCountries: TopCountry[];
topIpsDstIPs: TopBlockedIP[];
```

## 3. Frontend - `AnalyzerCategorySheet.tsx`

Novo `renderIPSContent()`:

```
┌──────────────────────────────┐
│ Header: Eventos IPS          │
├──────────────────────────────┤
│ [Card] Top Ataques           │  ← sempre visível, acima das abas
│  SQL Injection... 142        │
│  Brute Force...    87        │
├──────────────────────────────┤
│ ─── Separator ───            │
│ [Atacantes] [Alvos]          │  ← abas
├──────────────────────────────┤
│ Tab Atacantes:               │
│  • Top IPs (com bandeira)    │
│  • Top Países                │
│                              │
│ Tab Alvos:                   │
│  • Top IPs Alvo (com ícone   │
│    Server para IPs privados) │
└──────────────────────────────┘
```

- Aba "Atacantes": `topIpsSrcIPs` + `topIpsSrcCountries` (com bandeiras)
- Aba "Alvos": `topIpsDstIPs` (com ícone Server para IPs privados)
- Card "Top Ataques" fixo antes das abas, mostrando nome do ataque + contagem com badge de severidade

## 4. Montagem final (`index.ts` linha ~1455)

Mapear as novas métricas do `ipsResult.metrics` para o objeto final do snapshot.

## Arquivos modificados
- `supabase/functions/firewall-analyzer/index.ts` -- enriquecer `analyzeIPS()` + mapear métricas
- `src/types/analyzerInsights.ts` -- adicionar campos ao `AnalyzerMetrics`
- `src/components/firewall/AnalyzerCategorySheet.tsx` -- novo `renderIPSContent()`

