
# Frequência com badges detalhados — Página Ambiente

## Objetivo

Adicionar a coluna **Frequência** nas tabelas de **Domínios Externos** e **Firewalls** dentro da página `/environment`, com o mesmo padrão visual (badge colorido + badge secundário com horário/dia).

A tabela de **Tenants M365** não terá a coluna, pois não possui agenda configurável.

---

## Arquitetura atual

A página usa um componente unificado `AssetCategorySection` com uma interface `AssetItem` compartilhada. Para não quebrar a renderização dos Tenants M365, a abordagem correta é:

1. Adicionar o campo `scheduleFrequency`, `scheduleHour`, `scheduleDayOfWeek` e `scheduleDayOfMonth` como opcionais em `UnifiedAsset` e `AssetItem`.
2. Buscar os schedules de `external_domain_schedules` e `analysis_schedules` junto com os outros dados no `useQuery`.
3. Passar uma prop `showFrequency` para `AssetCategorySection`, que exibe ou oculta a coluna conforme o tipo de ativo.

---

## Mudanças técnicas

### 1. `src/pages/EnvironmentPage.tsx`

**a) Interface `UnifiedAsset`** — adicionar campos opcionais:
```ts
scheduleFrequency?: string | null;
scheduleHour?: number;
scheduleDayOfWeek?: number;
scheduleDayOfMonth?: number;
```

**b) `useQuery` `environment-assets`** — adicionar buscas paralelas de schedules:
```ts
let fwScheduleQuery = supabase
  .from('analysis_schedules')
  .select('firewall_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month')
  .eq('is_active', true);

let edScheduleQuery = supabase
  .from('external_domain_schedules')
  .select('domain_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month')
  .eq('is_active', true);
```

Se `workspaceFilter` não for aplicável diretamente, os schedules são filtrados pelo ID do ativo após o fetch (usando `Map`).

**c) Construir mapas e popular os campos nos assets:**
```ts
const fwScheduleMap = new Map(
  (fwScheduleRes.data || []).map(s => [s.firewall_id, s])
);
const edScheduleMap = new Map(
  (edScheduleRes.data || []).map(s => [s.domain_id, s])
);

// Firewall:
scheduleFrequency: fwScheduleMap.get(fw.id)?.frequency ?? null,
scheduleHour: fwScheduleMap.get(fw.id)?.scheduled_hour ?? 0,
scheduleDayOfWeek: fwScheduleMap.get(fw.id)?.scheduled_day_of_week ?? 1,
scheduleDayOfMonth: fwScheduleMap.get(fw.id)?.scheduled_day_of_month ?? 1,

// External domain:
scheduleFrequency: edScheduleMap.get(ed.id)?.frequency ?? null,
scheduleHour: edScheduleMap.get(ed.id)?.scheduled_hour ?? 0,
scheduleDayOfWeek: edScheduleMap.get(ed.id)?.scheduled_day_of_week ?? 1,
scheduleDayOfMonth: edScheduleMap.get(ed.id)?.scheduled_day_of_month ?? 1,
```

**d) Passar `showFrequency` para as seções relevantes:**
```tsx
<AssetCategorySection
  title="Domínios Externos"
  showFrequency
  ...
/>
<AssetCategorySection
  title="Firewalls"
  showFrequency
  ...
/>
<AssetCategorySection
  title="Tenants M365"
  // sem showFrequency
  ...
/>
```

---

### 2. `src/components/environment/AssetCategorySection.tsx`

**a) Atualizar `AssetItem`** com campos opcionais:
```ts
scheduleFrequency?: string | null;
scheduleHour?: number;
scheduleDayOfWeek?: number;
scheduleDayOfMonth?: number;
```

**b) Adicionar prop `showFrequency?: boolean`** em `AssetCategorySectionProps`.

**c) Adicionar constantes de estilo** (mesmas do padrão já em uso):
```ts
const FREQUENCY_BADGE_STYLES: Record<string, string> = {
  daily:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  weekly:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  monthly: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  manual:  'bg-muted text-muted-foreground border-border',
};
const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', manual: 'Manual',
};
const DAYS_OF_WEEK_SHORT: Record<number, string> = {
  0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb',
};
```

**d) Renderizar coluna condicionalmente** — cabeçalho e célula:
```tsx
{showFrequency && <TableHead>Frequência</TableHead>}

// Na TableRow:
{showFrequency && (
  <TableCell>
    <div className="flex flex-row flex-wrap items-center gap-1">
      <Badge variant="outline" className={FREQUENCY_BADGE_STYLES[freq]}>
        {FREQUENCY_LABELS[freq]}
      </Badge>
      {freq === 'daily' && (
        <Badge variant="outline" className={FREQUENCY_BADGE_STYLES.daily}>
          {String(asset.scheduleHour).padStart(2, '0')}:00
        </Badge>
      )}
      {freq === 'weekly' && (
        <Badge variant="outline" className={FREQUENCY_BADGE_STYLES.weekly}>
          {DAYS_OF_WEEK_SHORT[asset.scheduleDayOfWeek!]} · {String(asset.scheduleHour).padStart(2, '0')}:00
        </Badge>
      )}
      {freq === 'monthly' && (
        <Badge variant="outline" className={FREQUENCY_BADGE_STYLES.monthly}>
          Dia {asset.scheduleDayOfMonth} · {String(asset.scheduleHour).padStart(2, '0')}:00
        </Badge>
      )}
    </div>
  </TableCell>
)}
```

---

## Resultado visual esperado

| Nome | Agent | Workspace | Frequência | Score | Status | Ações |
|---|---|---|---|---|---|---|
| example.com | agent-01 | Cliente X | 🔵 Diário + 🔵 `02:00` | 87% | Analisado | ✏️ 🗑️ |
| FW-Core | agent-02 | Cliente Y | 🟣 Semanal + 🟣 `Seg · 14:00` | 72% | Analisado | ✏️ 🗑️ |

Os Tenants M365 não exibem a coluna Frequência.

## Arquivos modificados

- `src/pages/EnvironmentPage.tsx`
- `src/components/environment/AssetCategorySection.tsx`
