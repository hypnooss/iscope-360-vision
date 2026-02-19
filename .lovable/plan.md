
# Ajuste do Modal de Agendamento — Firewall Analyzer

## Problema

O modal de agendamento do Firewall Analyzer usa campos `<Input type="number">` para hora e dia do mês, enquanto o Surface Analyzer usa `<Select>` com dropdowns, resultando em uma inconsistência visual e de UX entre os dois modais.

## Mudanças necessárias em `src/pages/firewall/AnalyzerDashboardPage.tsx`

### 1. Campo "Hora de execução" — trocar Input por Select

**Antes:**
```tsx
<Label>Hora de execução (0–23)</Label>
<Input type="number" min={0} max={23} value={scheduleHour} ... />
```

**Depois (igual ao Surface Analyzer):**
```tsx
<Label>Hora de execução (UTC-3)</Label>
<Select value={String(scheduleHour)} onValueChange={(v) => setScheduleHour(Number(v))}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    {Array.from({ length: 24 }, (_, i) => (
      <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 2. Campo "Dia do mês" — trocar Input por Select

**Antes:**
```tsx
<Label>Dia do mês (1–28)</Label>
<Input type="number" min={1} max={28} value={scheduleDayOfMonth} ... />
```

**Depois (igual ao Surface Analyzer):**
```tsx
<Label>Dia do mês</Label>
<Select value={String(scheduleDayOfMonth)} onValueChange={(v) => setScheduleDayOfMonth(Number(v))}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    {Array.from({ length: 28 }, (_, i) => (
      <SelectItem key={i + 1} value={String(i + 1)}>Dia {i + 1}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 3. Adicionar opção "Por Hora" na frequência

Adicionar `<SelectItem value="hourly">Por Hora</SelectItem>` no Select de frequência.

Quando selecionado `hourly`, a hora de execução não se aplica (executa a cada hora), portanto o campo de hora fica oculto.

### 4. Atualizar `calculateNextRun` para suportar `hourly`

```tsx
if (freq === 'hourly') {
  next.setMinutes(0, 0, 0);
  next.setTime(next.getTime() + 60 * 60 * 1000); // próxima hora cheia
}
```

### 5. Ajuste visual do "Next run preview"

Trocar `bg-secondary/50 border border-border` por `bg-muted/20 border border-border/50` para alinhar com o padrão do Surface Analyzer.

## Arquivo modificado

- `src/pages/firewall/AnalyzerDashboardPage.tsx` (apenas o bloco do Schedule Dialog, linhas 855–949, e a função `calculateNextRun`, linhas 373–393)
