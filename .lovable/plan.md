

## Plano: Corrigir Data do Relatório e Redesenho do Gauge

### Contexto

Dois problemas identificados na página de Análise de Compliance do Firewall:

1. **Data incorreta**: O campo "Relatório gerado em" mostra a data/hora de abertura, não de geração
2. **Gauge redesenhando**: A cada navegação, o gauge anima novamente do zero

---

### Problema 1: Data do Relatório

**Causa Raiz:**
- Em `normalizeReportData` (linha 99): `generatedAt: new Date(rawData.generatedAt || Date.now())`
- O fallback `Date.now()` é chamado quando não há data, gerando timestamp atual
- Quando vem do `location.state`, a data de criação do banco não é incluída

**Solução:**

#### Alteração 1.1 - `FirewallAnalysis.tsx` - Melhorar `normalizeReportData`

Não usar `Date.now()` como fallback. Se não houver data, manter `undefined` ou usar uma data que indique que é desconhecida.

```typescript
// Linha 99 - Antes:
generatedAt: new Date(rawData.generatedAt as string || Date.now()),

// Depois:
generatedAt: rawData.generatedAt 
  ? new Date(rawData.generatedAt as string) 
  : new Date(),
```

Mas o problema real é que quando vem do `location.state`, o `generatedAt` pode não estar populado. Precisamos garantir que ao navegar para a página, a data correta seja passada.

#### Alteração 1.2 - Buscar `created_at` quando usando `location.state`

Quando há `initialReport` do `location.state`, ainda precisamos buscar a data real do banco. Modificar o `useEffect`:

```typescript
// Se veio do state, ainda buscar a data real do histórico
useEffect(() => {
  if (id && user) {
    fetchFirewall();
    // Sempre buscar a análise para ter a data correta
    if (!initialReport) {
      fetchLastAnalysis();
    } else {
      // Se veio do state, buscar apenas para atualizar a data
      fetchAnalysisDate();
    }
  }
}, [id, user]);

const fetchAnalysisDate = async () => {
  const { data } = await supabase
    .from('analysis_history')
    .select('created_at')
    .eq('firewall_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.created_at && report) {
    setReport(prev => prev ? { ...prev, generatedAt: new Date(data.created_at) } : null);
  }
};
```

---

### Problema 2: Gauge Redesenhando

**Causa Raiz:**
- `ScoreGauge.tsx` inicializa `animatedScore` como `0` sempre
- O `useEffect` anima de 0 até o score a cada montagem
- Não há mecanismo para "lembrar" que já animou

**Solução:**

Usar `useRef` para rastrear se já animou uma vez. Após a primeira animação, iniciar direto no valor final.

#### Alteração 2.1 - `ScoreGauge.tsx` - Evitar re-animação

```typescript
import { useEffect, useState, useRef } from "react";

export function ScoreGauge({ score, size = 200 }: ScoreGaugeProps) {
  const hasAnimated = useRef(false);
  const [animatedScore, setAnimatedScore] = useState(() => 
    hasAnimated.current ? score : 0
  );

  useEffect(() => {
    // Se já animou antes, apenas atualiza direto
    if (hasAnimated.current) {
      setAnimatedScore(score);
      return;
    }

    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setAnimatedScore(score);
        hasAnimated.current = true;
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  // ... resto do componente
}
```

**Nota:** O `useRef` não persiste entre desmontagens. Para resolver completamente, podemos usar uma abordagem diferente - animar apenas na primeira montagem e usar CSS transitions para mudanças subsequentes.

#### Alteração 2.2 - Abordagem Alternativa (Mais Robusta)

Usar `sessionStorage` ou um contexto para persistir se o gauge já foi visto. Ou simplesmente **não animar** quando o score já foi carregado anteriormente.

A abordagem mais simples é verificar se o componente está sendo montado com dados que já existiam:

```typescript
interface ScoreGaugeProps {
  score: number;
  size?: number;
  skipAnimation?: boolean; // Nova prop
}

export function ScoreGauge({ score, size = 200, skipAnimation = false }: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(skipAnimation ? score : 0);

  useEffect(() => {
    if (skipAnimation) {
      setAnimatedScore(score);
      return;
    }
    // ... animação normal
  }, [score, skipAnimation]);
}
```

E no `Dashboard.tsx`:

```tsx
<ScoreGauge score={report.overallScore} size={180} skipAnimation={!isFirstLoad} />
```

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/FirewallAnalysis.tsx` | Buscar data real do `created_at` do banco |
| `src/components/ScoreGauge.tsx` | Adicionar `skipAnimation` prop para evitar re-animação |
| `src/components/Dashboard.tsx` | Passar `skipAnimation` quando apropriado |

---

### Resultado Esperado

1. **Data correta**: "Relatório gerado em" mostrará a data/hora real de quando a análise foi executada
2. **Gauge estável**: O gauge não redesenhará ao trocar de tela, mostrando o valor diretamente

