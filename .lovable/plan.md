

# Adicionar botão de agendamento no Exchange Analyzer

## Situação atual

- A tabela `m365_analyzer_schedules` já existe com RLS configurado
- O componente reutilizável `ScheduleDialog` já suporta `m365_analyzer_schedules` + `tenant_record_id`
- O M365PosturePage já usa exatamente esse padrão — basta replicar no Exchange Analyzer

## Alteração

### `src/pages/m365/ExchangeAnalyzerPage.tsx`

1. Adicionar import de `Settings` (lucide) e `ScheduleDialog`
2. Adicionar state `scheduleDialogOpen`
3. Ao lado do botão "Executar Análise", adicionar botão de engrenagem:

```tsx
<Button variant="outline" size="icon" title="Configurar agendamento"
  disabled={!selectedTenantId} onClick={() => setScheduleDialogOpen(true)}>
  <Settings className="w-4 h-4" />
</Button>
```

4. No final do JSX, renderizar o `ScheduleDialog`:

```tsx
<ScheduleDialog
  open={scheduleDialogOpen}
  onOpenChange={setScheduleDialogOpen}
  entityId={selectedTenantId ?? ''}
  table="m365_analyzer_schedules"
  entityColumn="tenant_record_id"
  title="Agendamento do Exchange Analyzer"
  description="Configure a frequência de execução automática da análise do Exchange Online."
  recommendation="Recomendamos agendar a execução 1 vez ao dia para manter a postura atualizada."
/>
```

Nenhuma migração necessária — tudo já existe no banco. Apenas ~15 linhas adicionadas em 1 arquivo.

