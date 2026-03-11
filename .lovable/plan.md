

## Plano: Timezone dinâmico — armazenar em UTC, exibir no fuso do usuário

### Contexto atual
- `dateUtils.ts` hardcoda `TZ = 'America/Sao_Paulo'` para toda exibição
- `ScheduleDialog.tsx` hardcoda `+3` para converter hora local → UTC
- Edge Function `run-scheduled-analyses` hardcoda `+3` em `calculateNextRunAt`
- 33 arquivos importam funções de `dateUtils.ts`

### Arquitetura proposta

```text
┌─────────────────────────────────────────────────────────┐
│  Banco de dados: tudo em UTC (já é assim)               │
│  + timezone column nas tabelas de agendamento           │
├─────────────────────────────────────────────────────────┤
│  Frontend (dateUtils.ts):                               │
│    getTZ() → lê timezone global (set pelo AuthContext)  │
│    Todas as funções format*() usam getTZ()              │
├─────────────────────────────────────────────────────────┤
│  ScheduleDialog:                                        │
│    Hora selecionada = hora no TZ do usuário              │
│    Conversão dinâmica para UTC via Intl.DateTimeFormat   │
│    Salva timezone do usuário junto com o schedule        │
├─────────────────────────────────────────────────────────┤
│  Edge Function:                                         │
│    Lê timezone de cada schedule record                   │
│    Usa Intl para converter scheduled_hour → UTC          │
└─────────────────────────────────────────────────────────┘
```

### Mudanças detalhadas

#### 1. Migration SQL — adicionar `timezone` em todas as tabelas de agendamento

Adicionar coluna `timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo'` nas 6 tabelas:
- `analysis_schedules`
- `analyzer_schedules`
- `external_domain_schedules`
- `m365_analyzer_schedules`
- `m365_compliance_schedules`
- `attack_surface_schedules`

O default `America/Sao_Paulo` garante que registros existentes (criados com a lógica antiga de +3) continuem corretos.

#### 2. `src/lib/dateUtils.ts` — timezone dinâmico

- Substituir `const TZ = 'America/Sao_Paulo'` por um getter/setter global:
  ```typescript
  let _userTZ = 'UTC';
  export function setUserTimezone(tz: string) { _userTZ = tz; }
  export function getUserTimezone(): string { return _userTZ; }
  ```
- Todas as funções `formatDateBR`, `formatDateTimeBR`, etc. passam a usar `getUserTimezone()` em vez do `TZ` hardcoded
- Renomear `toBRT` para `toUserTZ` (mantendo `toBRT` como alias para retrocompatibilidade)

**Impacto zero nos 33 arquivos consumidores** — as assinaturas das funções não mudam.

#### 3. `src/contexts/AuthContext.tsx` — setar timezone global ao carregar perfil

Após carregar `profile.timezone`, chamar `setUserTimezone(profile.timezone)`:
```typescript
import { setUserTimezone } from '@/lib/dateUtils';
// no fetchUserData, após obter o profile:
setUserTimezone(profile.timezone || 'UTC');
```

#### 4. `src/components/schedule/ScheduleDialog.tsx` — conversão dinâmica

- Importar `getUserTimezone` de dateUtils
- Substituir o hardcoded `+3` por cálculo dinâmico do offset UTC do timezone do usuário usando `Intl.DateTimeFormat`
- Salvar `timezone: getUserTimezone()` no payload do upsert

#### 5. `supabase/functions/run-scheduled-analyses/index.ts` — ler timezone do schedule

- Incluir `timezone` no `select('*')` (já vem com `*`)
- Alterar `calculateNextRunAt` para receber `timezone: string` e calcular o offset dinamicamente via `Intl.DateTimeFormat` (disponível no Deno runtime)
- Substituir o hardcoded `(hour + 3) % 24` por conversão dinâmica

#### 6. Função helper para offset dinâmico (usada no frontend e edge function)

```typescript
function getUtcOffsetHours(timezone: string): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(now);
  const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT';
  // Parse "GMT-3", "GMT+5:30", etc.
  const match = offsetStr.match(/GMT([+-]?\d+)?(?::(\d+))?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  return hours + (hours >= 0 ? minutes / 60 : -minutes / 60);
}
```

### Resumo de impacto

| Arquivo | Tipo de mudança |
|---|---|
| 6 tabelas de agendamento | Migration: +coluna `timezone` |
| `dateUtils.ts` | TZ dinâmico via getter/setter |
| `AuthContext.tsx` | Chamar `setUserTimezone` |
| `ScheduleDialog.tsx` | Conversão dinâmica + salvar timezone |
| `run-scheduled-analyses/index.ts` | Ler timezone, offset dinâmico |
| 33 arquivos consumidores | **Nenhuma mudança** |

