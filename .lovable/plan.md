
# Botão de Agendamento no Firewall Analyzer

## O que será feito

Adicionar um botão de engrenagem (⚙️) ao lado direito do botão "Executar Análise" na página `Firewall > Analyzer`, que abre um modal de configuração de agendamento — idêntico ao já existente no Surface Analyzer.

## Layout resultante

```text
[ Workspace ] [ Firewall ] [ ▶ Executar Análise ] [ ⚙️ ]
```

## Tabela utilizada

A tabela `analyzer_schedules` já existe no banco com as colunas necessárias:
- `firewall_id`, `frequency`, `scheduled_hour`, `scheduled_day_of_week`, `scheduled_day_of_month`, `next_run_at`, `is_active`

O agendamento é **por firewall** (não por workspace), exatamente como ocorre com o firewall compliance.

## Alterações técnicas em `AnalyzerDashboardPage.tsx`

### 1. Novos imports

Adicionar ao bloco de imports existente:
- Ícones: `Settings`, `Calendar` (já importados de `lucide-react`, só adicionar)
- Componentes UI: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` (do `@/components/ui/dialog`)
- `Label` (do `@/components/ui/label`)
- `Switch` (do `@/components/ui/switch`)
- `useQueryClient` (do `@tanstack/react-query`)
- `toast` (do `sonner`)

### 2. Novos estados (dentro do componente)

```tsx
const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
const [scheduleFreq, setScheduleFreq] = useState<string>('daily');
const [scheduleHour, setScheduleHour] = useState<number>(15);
const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState<number>(1);
const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState<number>(1);
const [scheduleActive, setScheduleActive] = useState<boolean>(true);
const [scheduleSaving, setScheduleSaving] = useState(false);
```

### 3. Query para carregar o agendamento atual

```tsx
const { data: currentSchedule, refetch: refetchSchedule } = useQuery({
  queryKey: ['analyzer-schedule', selectedFirewall],
  queryFn: async () => {
    if (!selectedFirewall) return null;
    const { data } = await supabase
      .from('analyzer_schedules')
      .select('*')
      .eq('firewall_id', selectedFirewall)
      .maybeSingle();
    return data ?? null;
  },
  enabled: !!selectedFirewall && isSuperRole,
});
```

### 4. useEffect para sincronizar formulário ao abrir o modal

```tsx
useEffect(() => {
  if (currentSchedule && scheduleDialogOpen) {
    setScheduleFreq(currentSchedule.frequency ?? 'daily');
    setScheduleHour(currentSchedule.scheduled_hour ?? 15);
    setScheduleDayOfWeek(currentSchedule.scheduled_day_of_week ?? 1);
    setScheduleDayOfMonth(currentSchedule.scheduled_day_of_month ?? 1);
    setScheduleActive(currentSchedule.is_active ?? true);
  }
}, [currentSchedule, scheduleDialogOpen]);
```

### 5. Função `calculateNextRun` (mesma lógica do Surface Analyzer)

Adicionada como função local dentro do arquivo.

### 6. Função `handleSaveSchedule`

Faz `upsert` na tabela `analyzer_schedules` com `onConflict: 'firewall_id'`. A tabela `analyzer_schedules` já possui uma unique constraint em `firewall_id` (verificado no schema).

### 7. Botão de engrenagem no header

Adicionado após o botão "Executar Análise", visível apenas para `isSuperRole`:

```tsx
{isSuperRole && (
  <Button
    variant="outline"
    size="icon"
    title="Configurar agendamento"
    disabled={!selectedFirewall}
    onClick={() => setScheduleDialogOpen(true)}
  >
    <Settings className="w-4 h-4" />
  </Button>
)}
```

### 8. Dialog de agendamento

Modal idêntico ao do Surface Analyzer, adaptado para o Firewall Analyzer:
- Título: "Agendamento do Firewall Analyzer"
- Descrição: "Configure a frequência de execução automática do Analyzer para este firewall"
- Campos: Ativo (switch), Frequência (daily/weekly/monthly), Hora, Dia da semana (se semanal), Dia do mês (se mensal)
- Preview da próxima execução estimada
- Botões: Cancelar / Salvar

## Arquivo modificado

- `src/pages/firewall/AnalyzerDashboardPage.tsx`

Nenhuma migração de banco de dados é necessária — a tabela `analyzer_schedules` já existe com todas as colunas necessárias e com RLS configurado para super admins.
