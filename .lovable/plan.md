
# Frequência com badges detalhados — Firewall > Compliance

## Objetivo

Aplicar os mesmos ajustes já feitos em Domínio Externo: a coluna **Frequência** exibe badges coloridos com um segundo badge inline mostrando o horário/dia configurado.

## Arquivo modificado

`src/pages/firewall/FirewallReportsPage.tsx`

---

## Mudanças técnicas

### 1. Query `analysis_schedules` (linha 169)

Adicionar os campos de timing:

```ts
// Antes:
.select('firewall_id, frequency')

// Depois:
.select('firewall_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month')
```

### 2. Tipo do estado `firewallsMeta` (linha 65)

Adicionar os três campos ao tipo inline:

```ts
schedule_hour: number;
schedule_day_of_week: number;
schedule_day_of_month: number;
```

### 3. `setFirewallsMeta` (linha 199)

Incluir os novos campos ao construir o objeto:

```ts
schedule_frequency: scheduleMap.get(f.id)?.frequency || null,
schedule_hour: scheduleMap.get(f.id)?.scheduled_hour ?? 0,
schedule_day_of_week: scheduleMap.get(f.id)?.scheduled_day_of_week ?? 1,
schedule_day_of_month: scheduleMap.get(f.id)?.scheduled_day_of_month ?? 1,
```

### 4. Interface `GroupedFirewall` (linha 36)

Adicionar os campos:

```ts
schedule_hour: number;
schedule_day_of_week: number;
schedule_day_of_month: number;
```

### 5. `useMemo groupedFirewalls` — seed de firewalls (linha 232)

Propagar os novos campos ao construir cada grupo:

```ts
schedule_hour: f.schedule_hour,
schedule_day_of_week: f.schedule_day_of_week,
schedule_day_of_month: f.schedule_day_of_month,
```

### 6. Constantes auxiliares (acima do componente)

Adicionar junto às constantes existentes (`FREQUENCY_COLORS`, `frequencyLabel`):

```ts
const DAYS_OF_WEEK_SHORT: Record<number, string> = {
  0: 'Dom', 1: 'Seg', 2: 'Ter',
  3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb',
};
```

### 7. Célula Frequência (linhas 595–604)

Substituir o badge simples por dois badges inline:

```tsx
<TableCell>
  <div className="flex flex-row flex-wrap items-center gap-1">
    <Badge variant="outline" className={`text-xs ${FREQUENCY_COLORS[freq] || ''}`}>
      {frequencyLabel(freq)}
    </Badge>

    {/* Badge secundário — mesmo estilo do badge principal */}
    {freq === 'daily' && (
      <Badge variant="outline" className={`text-xs ${FREQUENCY_COLORS.daily}`}>
        {String(group.schedule_hour).padStart(2, '0')}:00
      </Badge>
    )}
    {freq === 'weekly' && (
      <Badge variant="outline" className={`text-xs ${FREQUENCY_COLORS.weekly}`}>
        {DAYS_OF_WEEK_SHORT[group.schedule_day_of_week]} · {String(group.schedule_hour).padStart(2, '0')}:00
      </Badge>
    )}
    {freq === 'monthly' && (
      <Badge variant="outline" className={`text-xs ${FREQUENCY_COLORS.monthly}`}>
        Dia {group.schedule_day_of_month} · {String(group.schedule_hour).padStart(2, '0')}:00
      </Badge>
    )}
  </div>
</TableCell>
```

---

## Resultado visual esperado

| Frequência | Badge principal | Badge secundário |
|---|---|---|
| Manual | cinza "Manual" | — |
| Diário | azul "Diário" | azul `02:00` |
| Semanal | roxo "Semanal" | roxo `Seg · 14:00` |
| Mensal | âmbar "Mensal" | âmbar `Dia 15 · 08:00` |

## Arquivo modificado

- `src/pages/firewall/FirewallReportsPage.tsx`
