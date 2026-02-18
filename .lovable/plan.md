
# Frequência com badges detalhados — Domínio Externo > Compliance

## Objetivo

Na coluna **Frequência** da tabela de Compliance, os valores devem:
1. Ser exibidos como **badges coloridos** por tipo (Manual, Diário, Semanal, Mensal)
2. Mostrar o **detalhe da configuração** abaixo do badge principal:
   - **Diário** → horário (ex: `às 02:00 UTC`)
   - **Semanal** → dia da semana + horário (ex: `Segunda-feira às 14:00 UTC`)
   - **Mensal** → dia do mês + horário (ex: `Dia 15 às 08:00 UTC`)
   - **Manual** → sem detalhe adicional

## Arquivo modificado

`src/pages/external-domain/ExternalDomainReportsPage.tsx`

---

## Mudanças técnicas

### 1. Query da tabela `external_domain_schedules` (linha 151)

Adicionar os campos de timing na seleção:

```ts
// Antes:
.select('domain_id, frequency')

// Depois:
.select('domain_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month')
```

### 2. `scheduleMap` (linha 166)

Mudar o mapa para armazenar o objeto completo do schedule, não apenas a frequência:

```ts
// Antes:
const scheduleMap = new Map(
  (schedulesData || []).map((s) => [s.domain_id, s.frequency])
);

// Depois:
const scheduleMap = new Map(
  (schedulesData || []).map((s) => [s.domain_id, s])
);
```

### 3. `domainsMeta` state type (linha 68)

Adicionar campos ao tipo inline:

```ts
{ 
  id: string; name: string; domain: string; 
  client_id: string; agent_id: string | null; 
  client_name: string; 
  schedule_frequency: string;
  schedule_hour: number;
  schedule_day_of_week: number;
  schedule_day_of_month: number;
}
```

### 4. `setDomainsMeta` (linha 189)

Incluir os campos ao montar o objeto de metadata:

```ts
schedule_frequency: scheduleMap.get(d.id)?.frequency || 'manual',
schedule_hour: scheduleMap.get(d.id)?.scheduled_hour ?? 2,
schedule_day_of_week: scheduleMap.get(d.id)?.scheduled_day_of_week ?? 1,
schedule_day_of_month: scheduleMap.get(d.id)?.scheduled_day_of_month ?? 1,
```

### 5. `GroupedDomain` interface (linha 43)

Adicionar campos:

```ts
schedule_frequency: string;
schedule_hour: number;
schedule_day_of_week: number;
schedule_day_of_month: number;
```

### 6. Propagação no `useMemo` de `groupedDomains`

Ao setar os grupos a partir de `filteredMeta`, propagar os novos campos:

```ts
schedule_hour: d.schedule_hour,
schedule_day_of_week: d.schedule_day_of_week,
schedule_day_of_month: d.schedule_day_of_month,
```

### 7. Constantes auxiliares — dias da semana (acima do componente)

```ts
const DAYS_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Domingo', 1: 'Segunda-feira', 2: 'Terça-feira',
  3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado',
};

const FREQUENCY_BADGE_STYLES: Record<string, string> = {
  daily:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  weekly:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  monthly: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  manual:  'bg-muted text-muted-foreground border-border',
};
```

### 8. Renderização da célula Frequência (linhas 681–685)

Substituir o badge simples por uma célula com badge principal + detalhe:

```tsx
<TableCell>
  <div className="flex flex-col gap-1">
    <Badge
      variant="outline"
      className={FREQUENCY_BADGE_STYLES[group.schedule_frequency] || FREQUENCY_BADGE_STYLES.manual}
    >
      {FREQUENCY_LABELS[group.schedule_frequency] || 'Manual'}
    </Badge>

    {group.schedule_frequency === 'daily' && (
      <span className="text-xs text-muted-foreground">
        às {String(group.schedule_hour).padStart(2, '0')}:00 UTC
      </span>
    )}
    {group.schedule_frequency === 'weekly' && (
      <span className="text-xs text-muted-foreground">
        {DAYS_OF_WEEK_LABELS[group.schedule_day_of_week]} às{' '}
        {String(group.schedule_hour).padStart(2, '0')}:00 UTC
      </span>
    )}
    {group.schedule_frequency === 'monthly' && (
      <span className="text-xs text-muted-foreground">
        Dia {group.schedule_day_of_month} às{' '}
        {String(group.schedule_hour).padStart(2, '0')}:00 UTC
      </span>
    )}
  </div>
</TableCell>
```

---

## Resultado visual esperado

| Frequência | Badge | Detalhe |
|---|---|---|
| Manual | badge cinza "Manual" | — |
| Diário | badge azul "Diário" | `às 02:00 UTC` |
| Semanal | badge roxo "Semanal" | `Segunda-feira às 14:00 UTC` |
| Mensal | badge laranja "Mensal" | `Dia 15 às 08:00 UTC` |

## Arquivo modificado

- `src/pages/external-domain/ExternalDomainReportsPage.tsx`
