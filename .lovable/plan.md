

## Plano: Remover opção "Por Hora" do agendamento de Compliance

### Mudança

**`src/components/schedule/ScheduleDialog.tsx`** — remover o `SelectItem` com `value="hourly"` ("Por Hora") do select de frequência.

Isso afeta todos os usos do `ScheduleDialog`. Se a opção "Por Hora" deve permanecer para o Analyzer, será necessário adicionar uma prop condicional. Caso contrário, remover globalmente.

### Arquivo editado (1)
- `src/components/schedule/ScheduleDialog.tsx`

