
# Adicionar Cores às Badges de Fabricante, Agent e Frequência

## Problema

O plano anterior foi aprovado mas não foi implementado. As badges das colunas **Fabricante**, **Agent** e **Frequência** na página Firewall > Compliance ainda estão sem cor (texto neutro/cinza).

## Arquivo a modificar

`src/pages/firewall/FirewallReportsPage.tsx`

---

## Mudança 1 — Adicionar constante `FREQUENCY_COLORS` (linha 429)

Inserir antes da função `frequencyLabel`:

```ts
const FREQUENCY_COLORS: Record<string, string> = {
  daily: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  weekly: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  monthly: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};
```

---

## Mudança 2 — Badge Fabricante (linha 586)

**Antes:**
```tsx
<Badge variant="outline" className="text-xs">{group.vendor_name}</Badge>
```

**Depois:**
```tsx
<Badge variant="outline" className="text-xs bg-orange-500/15 text-orange-400 border-orange-500/30">
  {group.vendor_name}
</Badge>
```

---

## Mudança 3 — Badge Agent (linha 593)

**Antes:**
```tsx
<Badge variant="outline" className="text-xs font-mono">{group.agent_name}</Badge>
```

**Depois:**
```tsx
<Badge variant="outline" className="text-xs font-mono bg-cyan-500/15 text-cyan-400 border-cyan-500/30">
  {group.agent_name}
</Badge>
```

---

## Mudança 4 — Badge Frequência (linhas 599–606)

**Antes:**
```tsx
{group.schedule_frequency ? (
  <Badge variant="secondary" className="text-xs capitalize">
    {frequencyLabel(group.schedule_frequency)}
  </Badge>
) : (
  <span className="text-muted-foreground text-sm">Manual</span>
)}
```

**Depois** (badge colorida para todos os casos, incluindo "Manual"):
```tsx
{(() => {
  const freq = group.schedule_frequency || 'manual';
  return (
    <Badge variant="outline" className={`text-xs ${FREQUENCY_COLORS[freq] || ''}`}>
      {frequencyLabel(freq)}
    </Badge>
  );
})()}
```

---

## Paleta de cores

| Coluna | Cor |
|---|---|
| Fabricante | Laranja (`orange-400`) |
| Agent | Ciano (`cyan-400`) |
| Frequência — Diário | Azul (`blue-400`) |
| Frequência — Semanal | Roxo (`purple-400`) |
| Frequência — Mensal | Âmbar (`amber-400`) |
| Frequência — Manual | Neutro (sem cor extra) |

Estas cores são as mesmas usadas na página Firewall > Firewalls.
