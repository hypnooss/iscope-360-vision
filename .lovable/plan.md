
# Botão de Configuração de Agendamento — AttackSurfaceAnalyzerPage

## O que será feito

Adicionar um botão com ícone de engrenagem (Settings) ao lado do botão "Executar Análise" na página `AttackSurfaceAnalyzerPage.tsx`. Ao clicar, abre um modal (Dialog) para configurar o agendamento automático do Analyzer para o workspace selecionado, utilizando a tabela `attack_surface_schedules` que já existe no banco.

---

## Análise do contexto existente

### Botões atuais (linha 1425–1451)
```tsx
<div className="flex items-center gap-3">
  {/* Seletor de Workspace (super roles) */}
  {isSuperRole && !isRunning && (
    <Button onClick={() => setScanDialogOpen(true)}>
      <Play /> Executar Análise
    </Button>
  )}
  {isSuperRole && isRunning && (
    <Button variant="destructive" onClick={() => cancelMutation.mutate()}>
      Cancelar Análise
    </Button>
  )}
</div>
```

### Tabela `attack_surface_schedules`
Estrutura já confirmada no banco:
- `id`, `client_id`, `frequency` (`daily`/`weekly`/`monthly`), `is_active`, `next_run_at`, `scheduled_hour`, `scheduled_day_of_week`, `scheduled_day_of_month`
- A chave única é `client_id` (um agendamento por workspace)

### Permissões RLS
- Super admins: `ALL` ✅
- Users com permissão de edição: `ALL` ✅
- O botão ficará visível para `isSuperRole` (super_admin / super_suporte)

---

## Implementação

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**1. Novos imports:**
```tsx
import { Settings, Calendar, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useQueryClient } from '@tanstack/react-query'; // já importado
import { toast } from 'sonner';
```

**2. Novo estado:**
```tsx
const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
```

**3. Query para buscar agendamento atual do workspace:**
```tsx
const { data: currentSchedule, refetch: refetchSchedule } = useQuery({
  queryKey: ['attack-surface-schedule', selectedClientId],
  queryFn: async () => {
    if (!selectedClientId) return null;
    const { data } = await supabase
      .from('attack_surface_schedules')
      .select('*')
      .eq('client_id', selectedClientId)
      .maybeSingle();
    return data ?? null;
  },
  enabled: !!selectedClientId && isSuperRole,
});
```

**4. Botão de engrenagem** ao lado de "Executar Análise":
```tsx
{isSuperRole && (
  <Button
    variant="outline"
    size="icon"
    title="Configurar agendamento"
    onClick={() => setScheduleDialogOpen(true)}
  >
    <Settings className="w-4 h-4" />
  </Button>
)}
```

**5. Modal `AttackSurfaceScheduleDialog` (inline no mesmo arquivo):**

O modal terá:
- **Frequência**: Select com `daily`, `weekly`, `monthly`
- **Hora** (0–23): Select numérico
- **Dia da semana** (só aparece se weekly): Select com nomes dos dias
- **Dia do mês** (só aparece se monthly): Select numérico 1–28
- **Ativo**: Switch para ativar/desativar
- **Botão Salvar**: faz `upsert` em `attack_surface_schedules` com `onConflict: 'client_id'`

Lógica de cálculo do `next_run_at` ao salvar: calcula a próxima data/hora baseada na frequência/hora/dia configurados (igual ao padrão que a edge function `run-scheduled-analyses` usa).

**Estrutura do modal:**
```tsx
<Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Calendar className="w-5 h-5" />
        Agendamento do Analyzer
      </DialogTitle>
      <DialogDescription>
        Configure a frequência de execução automática do Surface Analyzer
        {workspaceName && ` para ${workspaceName}`}.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 py-2">
      {/* Switch ativo/inativo */}
      {/* Select frequência */}
      {/* Select hora */}
      {/* Select dia da semana (weekly) */}
      {/* Select dia do mês (monthly) */}
      {/* Prévia: "Próxima execução estimada: ..." */}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancelar</Button>
      <Button onClick={handleSaveSchedule} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**6. Lógica de salvar (`handleSaveSchedule`):**
```tsx
const handleSaveSchedule = async () => {
  if (!selectedClientId) return;
  setSaving(true);
  try {
    const nextRunAt = calculateNextRun(freq, hour, dayOfWeek, dayOfMonth);
    const payload = {
      client_id: selectedClientId,
      frequency: freq,
      scheduled_hour: hour,
      scheduled_day_of_week: dayOfWeek,
      scheduled_day_of_month: dayOfMonth,
      is_active: isActive,
      next_run_at: nextRunAt.toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('attack_surface_schedules')
      .upsert(payload, { onConflict: 'client_id' });

    if (error) throw error;
    toast.success('Agendamento salvo com sucesso!');
    refetchSchedule();
    setScheduleDialogOpen(false);
  } catch (err: any) {
    toast.error('Erro ao salvar: ' + err.message);
  } finally {
    setSaving(false);
  }
};
```

**7. Função helper `calculateNextRun`:**
```ts
function calculateNextRun(
  frequency: string,
  hour: number,
  dayOfWeek: number,
  dayOfMonth: number
): Date {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, 0, 0, 0);

  if (frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    const currentDay = next.getDay();
    let daysUntil = (dayOfWeek - currentDay + 7) % 7;
    if (daysUntil === 0 && next <= now) daysUntil = 7;
    next.setDate(next.getDate() + daysUntil);
  } else if (frequency === 'monthly') {
    next.setDate(dayOfMonth);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(dayOfMonth);
    }
  }
  return next;
}
```

---

## Onde o botão aparece

O botão de engrenagem ficará **sempre visível** para `isSuperRole` (independente de a análise estar em andamento), pois configurar o agendamento não depende do estado atual do scan. Ficará à esquerda do botão "Executar Análise":

```text
[ ⚙️ ]  [ ▶ Executar Análise ]
```

ou durante scan em andamento:

```text
[ ⚙️ ]  [ ✕ Cancelar Análise ]
```

---

## Arquivo modificado

- `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`
