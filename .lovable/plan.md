

## Plano: Botão de agendamento (engrenagem) no Compliance + remover schedule das telas de cadastro/edição

### Resumo

Adicionar o botão de engrenagem (⚙️) ao lado de "Executar Análise" nas 3 páginas de Compliance, com modal de agendamento idêntico ao do Analyzer. Remover a seção de agendamento das telas de cadastro e edição de Firewall, Domínio Externo e do dialog AddExternalDomainDialog/EditExternalDomainDialog.

### Mudanças

#### 1. Compliance pages — Adicionar schedule dialog

**`src/pages/firewall/FirewallCompliancePage.tsx`**
- Adicionar estado do dialog de agendamento (scheduleDialogOpen, scheduleFreq, scheduleHour, etc.)
- Query para `analysis_schedules` com `firewall_id` selecionado (mesmo padrão do AnalyzerDashboardPage)
- Botão `<Button variant="outline" size="icon">` com `<Settings>` ao lado do "Executar Análise" (visível apenas para `isSuperRole`)
- Dialog de agendamento com frequência, hora, dia da semana/mês, toggle ativo, próxima execução (copiar exatamente do AnalyzerDashboardPage)
- `handleSaveSchedule` fazendo upsert em `analysis_schedules`

**`src/pages/external-domain/ExternalDomainCompliancePage.tsx`**
- Mesmo padrão, mas usando tabela `external_domain_schedules` com `domain_id`
- Botão ⚙️ ao lado de "Executar Análise"
- Dialog de agendamento

**`src/pages/m365/M365PosturePage.tsx`**
- Mesmo padrão, usando tabela `m365_analyzer_schedules` com `tenant_record_id`
- Botão ⚙️ ao lado de "Executar Análise"
- Dialog de agendamento
- Nota: O M365 Analyzer já usa `m365_analyzer_schedules`. A compliance page (M365PosturePage) usará a mesma tabela pois trata-se do mesmo tenant.

#### 2. Remover schedule das telas de cadastro/edição

**`src/pages/firewall/FirewallCreatePage.tsx`**
- Remover Card "Agendamento de Análise" inteiro (linhas ~448-519)
- Remover campos `schedule`, `scheduled_hour`, `scheduled_day_of_week`, `scheduled_day_of_month` do formData
- Remover lógica de `calculateNextRunAt` e insert em `analysis_schedules` no handleSave
- Remover tipo `ScheduleFrequency`, constantes `HOURS`, `DAYS_OF_WEEK`, `DAYS_OF_MONTH` (se não usadas em outro lugar)

**`src/pages/firewall/FirewallEditPage.tsx`**
- Mesmo: remover Card de agendamento, campos do formData, fetch de `analysis_schedules`, delete/insert no save
- Remover `calculateNextRunAt`

**`src/pages/external-domain/ExternalDomainEditPage.tsx`**
- Remover Card de agendamento inteiro
- Remover campos schedule do formData
- Remover fetch de `external_domain_schedules`, delete/insert no save
- Remover `calculateNextRunAt`

**`src/components/external-domain/AddExternalDomainDialog.tsx`**
- Remover campo `schedule` do formData e do payload (`AddExternalDomainPayload`)
- Remover Select de "Frequência de Análise" do dialog
- Tipo `ScheduleFrequency` continua exportado (usado por outros componentes)

**`src/components/external-domain/EditExternalDomainDialog.tsx`**
- Remover campo `schedule` do formData e do payload de `onSave`
- Remover Select de "Frequência de Análise" do dialog

### Detalhes técnicos

- As tabelas de schedule usadas são: `analysis_schedules` (firewall), `external_domain_schedules` (domínio externo), `m365_analyzer_schedules` (M365)
- O padrão do dialog é idêntico em todos os Analyzers: frequência (hourly/daily/weekly/monthly), hora UTC, dia da semana ou mês, toggle ativo/inativo, preview da próxima execução
- Para compliance de Firewall, reutilizamos a mesma tabela `analysis_schedules` — o agendamento controla quando a análise roda, independente de ser "compliance" ou "analyzer" (a mesma análise gera dados para ambos)
- Botão ⚙️ visível apenas para `isSuperRole`

### Arquivos editados (8)
- `src/pages/firewall/FirewallCompliancePage.tsx`
- `src/pages/external-domain/ExternalDomainCompliancePage.tsx`
- `src/pages/m365/M365PosturePage.tsx`
- `src/pages/firewall/FirewallCreatePage.tsx`
- `src/pages/firewall/FirewallEditPage.tsx`
- `src/pages/external-domain/ExternalDomainEditPage.tsx`
- `src/components/external-domain/AddExternalDomainDialog.tsx`
- `src/components/external-domain/EditExternalDomainDialog.tsx`

