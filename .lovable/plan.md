
# Plano: Centralizar Verticalmente os Stats Cards

## Problema Identificado

O ScoreGauge agora tem um SVG maior (200px + 32px de margem para sombra = 232px), o que fez o card da esquerda ficar mais alto. O card da direita (Firewall Info + Stats) precisa ter seu conteúdo centralizado verticalmente para alinhar visualmente com o gauge.

## Solução

Adicionar `justify-center` ao container flex do card da direita para centralizar verticalmente todo o conteúdo interno (Info do Firewall + Separador + Stats Cards).

## Alteração Necessária

**Arquivo:** `src/components/Dashboard.tsx`

**Linha 82 - Atual:**
```tsx
<div className="lg:col-span-2 glass-card rounded-xl p-5 border border-primary/20 flex flex-col">
```

**Linha 82 - Proposto:**
```tsx
<div className="lg:col-span-2 glass-card rounded-xl p-5 border border-primary/20 flex flex-col justify-center">
```

## Resultado Visual

```text
┌──────────────┬────────────────────────────────────────────────┐
│              │                                                │
│              │  ┌ FortiGate ┐  Nome: SAO-FW   FortiOS: v7.2  │
│     55%      │  └───────────┘  URL: ...       Modelo: FGT40F │
│   Risco Alto │                 Serial: ...    Uptime: 115d   │
│              │  ────────────────────────────────────────────  │
│              │  Verificações | Aprovadas | Falhas | Alertas  │
│              │                                                │
└──────────────┴────────────────────────────────────────────────┘
```

O conteúdo do card direito ficará centralizado verticalmente, alinhando-se com o centro do ScoreGauge.

## Complexidade

Mínima - Apenas adição de uma classe CSS (`justify-center`)
