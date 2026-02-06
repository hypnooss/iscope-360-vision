

# Plano: Correções no Layout do Relatório M365

## Problemas Identificados

Com base na imagem e feedback:

1. **Gauge sem fundo escuro**: O `M365ScoreGauge` não possui mais o fundo escuro no centro
2. **Espaçamento insuficiente**: Entre o gauge e os cards MiniStats ainda precisa de mais espaço (mt-10 → mt-12 ou mais)
3. **Símbolos ✓/✗ no COND. ACCESS**: Remover esses símbolos do valor
4. **ORIGEM AUTH não exibido**: Os países com bandeiras não estão aparecendo (mesmo quando disponíveis)
5. **Linhas duplas de separação**: O `DetailRow` já tem uma linha, e há também divisores manuais, causando linhas duplicadas

---

## Soluções

### 1. Restaurar Fundo Escuro no M365ScoreGauge

**Arquivo**: `src/components/m365/posture/M365ScoreGauge.tsx`

Adicionar um círculo de fundo escuro dentro do SVG:

```tsx
{/* Dark center background */}
<circle
  cx={config.size / 2}
  cy={config.size / 2}
  r={radius - config.strokeWidth}
  fill="hsl(220 18% 10%)"
/>
```

---

### 2. Aumentar Espaçamento entre Gauge e MiniStats

**Arquivo**: `src/pages/m365/M365PostureReportPage.tsx`

Linha 447: Mudar `mt-10` para `mt-12` ou `mt-14`

```tsx
<div className="flex gap-3 mt-14">
```

---

### 3. Remover Símbolos ✓/✗ do COND. ACCESS

**Arquivo**: `src/pages/m365/M365PostureReportPage.tsx`

Linhas 494-500: Remover os símbolos do valor

```tsx
// Antes
value={envMetrics.conditionalAccessEnabled 
  ? `✓ ${envMetrics.conditionalAccessPoliciesCount} política(s) ativa(s)` 
  : '✗ Não configurado'}

// Depois
value={envMetrics.conditionalAccessEnabled 
  ? `${envMetrics.conditionalAccessPoliciesCount} política(s) ativa(s)` 
  : 'Não configurado'}
```

---

### 4. Corrigir Exibição dos Países (ORIGEM AUTH)

**Arquivo**: `src/pages/m365/M365PostureReportPage.tsx`

Renomear o label de "Top Países" para "Origem Auth" e garantir exibição:

```tsx
<DetailRow 
  label="Origem Auth" 
  value={envMetrics.loginCountries.slice(0, 5).map(c => 
    `${getCountryFlag(c.country)}`
  ).join(' ')}
/>
```

Caso não haja dados, mostrar "N/A" em vez de ocultar completamente.

---

### 5. Remover Linhas Duplas de Separação

O problema: `DetailRow` já renderiza uma linha após cada item (linha 119), e também há divisores manuais entre blocos (linhas 467, 486, 505).

**Solução**: Remover a linha automática do `DetailRow` e manter apenas os divisores manuais entre blocos lógicos.

**Arquivo**: `src/pages/m365/M365PostureReportPage.tsx`

Modificar o componente `DetailRow` para NÃO renderizar a linha:

```tsx
function DetailRow({ label, value, subValue, indicator, highlight }: DetailRowProps) {
  // ... existing code ...
  
  return (
    <div className="group">
      <div className="flex items-start gap-3 py-2">
        {/* ... content ... */}
      </div>
      {/* REMOVER esta linha: */}
      {/* <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent" /> */}
    </div>
  );
}
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/m365/posture/M365ScoreGauge.tsx` | Adicionar círculo de fundo escuro no centro |
| `src/pages/m365/M365PostureReportPage.tsx` | Aumentar espaçamento, remover ✓/✗, fix países, remover linhas duplas |

---

## Layout Final Esperado (Painel Direito)

```
DOMÍNIO        aggroupbr.onmicrosoft.com
TIPO AUTH      Cloud Only
───────────────────────────────────────
USUÁRIOS       436 ativos
               72 inativos, 119 guests
APLICAÇÕES     Enterprise: 45 | Apps: 23
───────────────────────────────────────
MFA            ● 45% habilitado
COND. ACCESS   ● Não configurado
───────────────────────────────────────
ORIGEM AUTH    🇧🇷 🇺🇸 🇵🇹
```

