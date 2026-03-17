

## Substituir bolinhas de status por gráfico de barras em degradê

### O que muda

Trocar as bolinhas (`w-3 h-3 rounded-full`) no `ScheduleTimeline` por um **gráfico de barra horizontal contínuo** (estilo heatmap/contribution graph), onde cada execução é um segmento colorido lado a lado, formando uma barra única com degradê visual entre as cores de status.

### Design visual

```text
┌─────────────────────────────────────────────────────┐
│ ███████████████████████████████████████████████████  │
│ verde  verde  verde  amarelo  verde  vermelho verde │
└─────────────────────────────────────────────────────┘
```

- Cada segmento representa uma execução, com largura proporcional (100% / nº de execuções)
- Cores: `#10b981` (sucesso), `#f43f5e` (falha), `#f59e0b` (timeout), `#3b82f6` (running), `#6b7280` (pending/cancelled)
- Segmentos adjacentes com **border-radius** nas pontas externas, criando uma barra contínua com aspecto de degradê
- Cada segmento mantém o **Tooltip** atual (data, duração, erro)
- A barra ocupa 100% da largura disponível — quanto mais execuções, mais estreitos os segmentos; quanto menos, mais largos
- Altura fixa de ~20px

### Implementação

**Arquivo:** `src/pages/admin/SchedulesPage.tsx` — função `ScheduleTimeline`

1. Substituir o `<div className="flex flex-wrap items-center gap-1.5">` com bolinhas por um `<div className="flex w-full h-5 rounded-md overflow-hidden">` onde cada execução é um `<button>` com `flex: 1`, `min-width: 2px`, cor de fundo baseada no status, e sem gap (para criar efeito contínuo/degradê)
2. Manter `TooltipProvider` e `Tooltip` em cada segmento
3. Manter os contadores de sucesso/falha no header
4. Usar cores hex inline (`style={{ backgroundColor }}`) em vez de classes Tailwind para facilitar o mapeamento

### Mapeamento de cores (hex para inline style)

```
completed  → #10b981
failed     → #ef4444
timeout    → #f59e0b
running    → #3b82f6
pending    → #6b7280
cancelled  → #4b5563
```

