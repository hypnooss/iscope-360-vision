
# Plano: Padronizar ScoreGauge com Design do M365

## Objetivo

Unificar o componente de gauge para todos os relatórios (M365, Domínio Externo, Firewall), adotando o design visual premium do `M365ScoreGauge` como padrão.

---

## Análise das Diferenças

| Característica | ScoreGauge Atual | M365ScoreGauge |
|----------------|------------------|----------------|
| Centro | Transparente | Fundo escuro preenchido |
| Glow externo | `drop-shadow` 3px | `box-shadow` 30px radial |
| Anel de fundo | Opacidade 100% | Opacidade 30% |
| Tamanhos | Número único (size) | Presets (sm/md/lg) |
| Classificação | Calculada internamente | Recebida via prop |
| Animação | Sim (contador) | Não |

---

## Estratégia

Atualizar o componente `ScoreGauge.tsx` para incorporar o design visual do `M365ScoreGauge`, mantendo retrocompatibilidade e adicionando a animação numérica como diferencial.

### Novo Design Unificado

1. **Fundo escuro central** - Preenchimento circular escuro para destaque
2. **Glow radial** - Sombra colorida baseada na classificação
3. **Anel de fundo sutil** - Opacidade 30% para contraste
4. **Classificação automática** - Calcula internamente baseado no score
5. **Tamanhos preset** - sm (120px), md (160px), lg (200px)
6. **Animação opcional** - Contador animado mantido

---

## Alterações Técnicas

### Arquivo: `src/components/ScoreGauge.tsx`

Reescrever com o novo design:

```typescript
interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg' | number; // Aceita preset ou número
  skipAnimation?: boolean;
  loading?: boolean;
}

// Classificação automática baseada no score
const getClassification = (score: number) => {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'attention';
  return 'critical';
};

// Cores por classificação (mesmo padrão M365)
const CLASSIFICATION_COLORS = {
  excellent: { text: 'text-primary', ring: 'stroke-primary', glow: '...' },
  good: { text: 'text-emerald-400', ring: 'stroke-emerald-400', glow: '...' },
  attention: { text: 'text-warning', ring: 'stroke-warning', glow: '...' },
  critical: { text: 'text-rose-400', ring: 'stroke-rose-400', glow: '...' },
};

// Tamanhos preset
const SIZE_CONFIG = {
  sm: { size: 120, strokeWidth: 8, fontSize: 'text-2xl' },
  md: { size: 160, strokeWidth: 10, fontSize: 'text-4xl' },
  lg: { size: 200, strokeWidth: 12, fontSize: 'text-5xl' },
};
```

**Visual atualizado:**
- Centro com fill escuro
- Glow radial externo colorido
- Label de classificação em uppercase
- Transições suaves

---

### Arquivos que Usam ScoreGauge (sem mudanças necessárias)

Os seguintes arquivos já usam `ScoreGauge` e herdarão o novo visual automaticamente:

| Arquivo | Uso |
|---------|-----|
| `src/components/Dashboard.tsx` | Firewall report header |
| `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx` | Domain report header |
| `src/pages/preview/FirewallReportPreview.tsx` | Preview page |
| `src/pages/preview/DomainReportPreview.tsx` | Preview page |
| `src/pages/m365/EntraIdAnalysisPage.tsx` | Entra ID legacy page |

---

### Arquivo: `src/pages/m365/M365PostureReportPage.tsx`

Migrar de `M365ScoreGauge` para o `ScoreGauge` unificado:

**Antes:**
```tsx
import { M365ScoreGauge } from '@/components/m365/posture/M365ScoreGauge';
// ...
<M365ScoreGauge score={reportData.score} classification={...} size="lg" />
```

**Depois:**
```tsx
import { ScoreGauge } from '@/components/ScoreGauge';
// ...
<ScoreGauge score={reportData.score} size="lg" />
```

---

### Ajuste de Espaçamento (mt-14 → mt-6)

Padronizar o espaçamento entre o gauge e os MiniStats em todos os relatórios:

| Relatório | Atual | Padronizado |
|-----------|-------|-------------|
| M365 | `mt-14` (56px) | `mt-6` (24px) |
| Domínio Externo | `mt-6` | `mt-6` ✓ |
| Firewall | `mt-6` | `mt-6` ✓ |

---

### Arquivo: `src/components/m365/posture/M365ScoreGauge.tsx`

**Opção:** Manter como wrapper ou deprecar

Recomendação: Deprecar e usar `ScoreGauge` diretamente, pois toda a lógica será absorvida.

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/ScoreGauge.tsx` | Reescrever com design M365 (glow, centro escuro, classificação automática) |
| `src/pages/m365/M365PostureReportPage.tsx` | Trocar `M365ScoreGauge` por `ScoreGauge`, ajustar espaçamento |
| `src/components/m365/posture/index.ts` | Remover export do `M365ScoreGauge` (opcional) |

---

## Resultado Visual

Todos os relatórios terão:
- ✓ Gauge com fundo escuro central
- ✓ Glow radial colorido baseado no score
- ✓ Label de classificação (Excelente/Bom/Atenção/Crítico)
- ✓ Animação numérica opcional
- ✓ Tamanhos padronizados (sm/md/lg)
- ✓ Cores consistentes em toda a aplicação
