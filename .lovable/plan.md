

# Administracao > Agendamentos - Painel Centralizado de Schedules

## Objetivo

Criar uma nova pagina em **Administracao > Agendamentos** (`/schedules`) que permita acompanhar todos os agendamentos ativos de analise de firewall em um painel centralizado.

## O que sera exibido

- Cards de resumo: total de agendamentos ativos, proximas execucoes nas proximas 1h/6h/24h, e ultima execucao com falha
- Tabela com todos os schedules mostrando:
  - Firewall (nome)
  - Workspace (cliente)
  - Frequencia (badge: Diario/Semanal/Mensal)
  - Horario/dia programado
  - Proxima execucao (com indicador visual de "em breve" para as proximas 1h)
  - Ultima analise (data + score com badge colorido)
  - Status da ultima execucao (sucesso/falha baseado na ultima task do firewall)
  - Status do agendamento (ativo/inativo)
- Filtros por workspace e frequencia
- Busca por nome de firewall

## Detalhes Tecnicos

### 1. Nova pagina: `src/pages/admin/SchedulesPage.tsx`

- Segue o padrao `AppLayout` + `PageBreadcrumb` + `p-6 lg:p-8 space-y-6`
- Query principal: `analysis_schedules` com join em `firewalls` (nome, last_score, last_analysis_at) e `clients` (nome)
- Query secundaria: busca a ultima `agent_task` de cada firewall para verificar se completou com sucesso ou falhou
- Acesso restrito a `super_admin` e `workspace_admin`

### 2. Navegacao: `src/components/layout/AppLayout.tsx`

- Adicionar link "Agendamentos" no menu Administracao (abaixo de "Templates")
- Icone: `Clock` (do lucide-react)
- Atualizar a deteccao de rota admin para incluir `/schedules`

### 3. Roteamento: `src/App.tsx`

- Adicionar rota: `<Route path="/schedules" element={<SchedulesPage />} />`
- Lazy load como as demais paginas admin

### 4. Dados utilizados

| Tabela | Campos | Proposito |
|---|---|---|
| `analysis_schedules` | id, firewall_id, frequency, is_active, next_run_at, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month | Dados do agendamento |
| `firewalls` | id, name, last_score, last_analysis_at, client_id | Info do firewall |
| `clients` | id, name | Nome do workspace |
| `agent_tasks` | status, target_id, completed_at | Status da ultima execucao |

### 5. Indicadores visuais

- **Proxima execucao**: texto relativo ("em 2 horas") + badge verde pulsante se < 1h
- **Score**: badge colorido seguindo o padrao de design (>=90 primary, >=75 emerald, >=60 yellow, <60 rose)
- **Status ultima task**: badge verde "Sucesso" ou vermelho "Falhou" ou cinza "Sem execucao"
- **Frequencia**: badges com mesmo estilo da FirewallListPage

### Arquivos modificados/criados

| Arquivo | Acao |
|---|---|
| `src/pages/admin/SchedulesPage.tsx` | Criar |
| `src/components/layout/AppLayout.tsx` | Editar (adicionar link no menu admin + deteccao de rota) |
| `src/App.tsx` | Editar (adicionar rota lazy) |

