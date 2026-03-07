

## Nova Página: Saúde do Microsoft 365 (Service Health)

### Objetivo

Criar uma nova página dentro do módulo Microsoft 365 que exibe o status de saúde dos serviços do tenant, com gráficos e tabela de incidentes/advisories — similar ao dashboard da imagem de referência.

### Arquitetura

A Microsoft Graph API já é utilizada pelo Analyzer para buscar dados de `/admin/serviceAnnouncement/issues`. A nova feature precisa de uma **edge function dedicada** que busque dados em tempo real (não do snapshot do Analyzer), pois o Service Health muda constantemente.

### Alterações

**1. Nova Edge Function: `supabase/functions/m365-service-health/index.ts`**

- Recebe `tenant_record_id` no body
- Usa a mesma lógica de `getGraphToken` (per-tenant + global fallback)
- Faz 2 chamadas Graph API:
  - `GET /admin/serviceAnnouncement/healthOverviews` — status geral dos serviços
  - `GET /admin/serviceAnnouncement/issues?$top=100` — incidentes e advisories
- Retorna JSON com `services` (status por serviço) e `issues` (lista de incidentes com título, status, classificação, workload, datas, conteúdo)

**2. Nova Página: `src/pages/m365/M365ServiceHealthPage.tsx`**

Layout com:
- **TenantSelector** no topo (reutiliza componente existente)
- **4 gráficos** (usando Recharts, já instalado):
  - Eventos por Tempo (LineChart)
  - Eventos por Status (PieChart/DonutChart — serviceDegradation, investigating, etc.)
  - Eventos por Tipo (PieChart — advisory vs incident)
  - Eventos por Serviço Afetado (PieChart — Exchange Online, SharePoint, Teams, etc.)
- **Tabela de detalhes** abaixo dos gráficos com colunas:
  - Data/Hora | Workload | Classificação | Ticket | Conteúdo | Última Atualização | Status | Resolvido
- Click em um incidente abre um **Sheet lateral** com detalhes completos

**3. Menu: Atualizar `AppLayout.tsx`**

- Adicionar item `{ label: 'Saúde do 365', href: '/scope-m365/service-health', icon: HeartPulse }`
- Posicionar após "Exchange Online"

**4. Rota: Atualizar `App.tsx`**

- Adicionar `<Route path="/scope-m365/service-health" element={<M365ServiceHealthPage />} />`

### Permissão

A Graph API usa `ServiceHealth.Read.All` para estes endpoints. O Analyzer já chama `/admin/serviceAnnouncement/issues` com sucesso, indicando que a permissão já está concedida nos tenants configurados. Não é necessário adicionar novo escopo.

### Arquivos

1. `supabase/functions/m365-service-health/index.ts` — nova edge function
2. `src/pages/m365/M365ServiceHealthPage.tsx` — nova página com gráficos + tabela
3. `src/components/layout/AppLayout.tsx` — adicionar menu "Saúde do 365"
4. `src/App.tsx` — adicionar rota

