

# Transformar "Adicionar Firewall" de modal para pagina inteira

## Resumo

Converter o modal `AddFirewallDialog` em uma pagina dedicada (`/scope-firewall/firewalls/new`) seguindo o mesmo layout da pagina de edicao (`FirewallEditPage`), com dois cards (Informacoes do Dispositivo + Agendamento), campos em grid de 2 colunas e configuracao completa de agendamento (hora, dia da semana, dia do mes).

## Problema atual

1. O modal e muito pequeno para a quantidade de campos (workspace, device type, agent, nome, URL, credenciais, descricao, agendamento)
2. Ao selecionar "Diario", "Semanal" ou "Mensal", nao aparece seletor de hora/dia
3. O insert na `analysis_schedules` nao inclui `scheduled_hour`, `scheduled_day_of_week`, `scheduled_day_of_month` nem `next_run_at`

## Mudancas

### 1. Criar `src/pages/firewall/FirewallCreatePage.tsx`

Nova pagina seguindo exatamente o layout do `FirewallEditPage`:

- Breadcrumb: `Firewall > Firewalls > Novo`
- Botao voltar para `/scope-firewall/firewalls`
- Titulo: "Novo Firewall"
- **Card 1 - Informacoes do Dispositivo**: campos em grid 2 colunas (Workspace, Tipo de Dispositivo, Agent, Nome, URL, Credenciais, Descricao)
- **Card 2 - Agendamento de Analise**: frequencia + campos condicionais:
  - Diario: seletor de hora (00:00 a 23:00)
  - Semanal: seletor de dia da semana + hora
  - Mensal: seletor de dia do mes (1-28) + hora
- Botoes: Cancelar + Adicionar

A logica de submit reutiliza o mesmo fluxo do `handleAddFirewall` da `FirewallListPage` (insert firewall, encrypt credentials, insert schedule com campos completos e `next_run_at`).

A funcao `calculateNextRunAt` sera copiada do `FirewallEditPage` (mesma logica).

### 2. Alterar `src/pages/firewall/FirewallListPage.tsx`

- Remover o componente `AddFirewallDialog` e seu import
- Substituir o botao `<AddFirewallDialog>` por um `<Button>` que navega para `/scope-firewall/firewalls/new`
- Mover a logica de `handleAddFirewall` para a nova pagina
- Manter o restante inalterado

### 3. Alterar `src/App.tsx`

- Adicionar rota `/scope-firewall/firewalls/new` apontando para `FirewallCreatePage`
- A rota deve ficar ANTES de `/scope-firewall/firewalls/:id/edit` para evitar conflito de matching

### 4. `AddFirewallDialog.tsx`

- Nao sera mais utilizado pela `FirewallListPage`
- Pode ser mantido no repositorio caso outros pontos o usem, mas deixara de ser importado

## Secao tecnica

### Estrutura do `FirewallCreatePage`

```text
Estado do formulario (identico ao EditPage):
- name, description, fortigate_url, api_key, auth_username, auth_password
- client_id, device_type_id, agent_id
- schedule (manual | daily | weekly | monthly)
- scheduled_hour (default 2)
- scheduled_day_of_week (default 1)
- scheduled_day_of_month (default 1)

Constantes (copiadas do EditPage):
- HOURS: 0-23 formatados como "HH:00"
- DAYS_OF_WEEK: Domingo a Sabado
- DAYS_OF_MONTH: 1-28
- SESSION_AUTH_DEVICE_CODES
- calculateNextRunAt()

Fetch on mount:
- clients (via supabase)
- device_types (category=firewall, is_active=true)

Fetch on client change:
- agents (client_id = selected, revoked=false)

Submit:
1. Insert firewall (name, description, url, client_id, device_type_id, agent_id)
2. Invoke manage-firewall-credentials (save)
3. If schedule !== manual:
   - calculateNextRunAt(schedule, hour, dayOfWeek, dayOfMonth)
   - Insert analysis_schedules com scheduled_hour, scheduled_day_of_week, 
     scheduled_day_of_month, next_run_at
4. toast.success + navigate('/scope-firewall/firewalls')
```

### Rota no App.tsx

```text
<Route path="/scope-firewall/firewalls/new" element={<FirewallCreatePage />} />
```

### Botao na FirewallListPage (substituindo AddFirewallDialog)

```text
<Button className="gap-2" onClick={() => navigate('/scope-firewall/firewalls/new')}>
  <Plus className="w-4 h-4" />
  Novo Firewall
</Button>
```

### Arquivos a criar/editar

- **Criar**: `src/pages/firewall/FirewallCreatePage.tsx`
- **Editar**: `src/pages/firewall/FirewallListPage.tsx` (remover dialog, simplificar botao)
- **Editar**: `src/App.tsx` (adicionar rota)

