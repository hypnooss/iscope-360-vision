

## Redesign: Saúde do Microsoft 365

### Resumo
Reescrever `M365ServiceHealthPage.tsx` com layout vertical em 6 seções, removendo PieCharts e substituindo por barras horizontais e gráfico de linha. Manter a mesma fonte de dados (edge function `m365-service-health`). Sem mudanças no backend.

### Dados Disponíveis
```
services: { id, service, status }[]
issues: { id, title, service, status, classification, startDateTime, endDateTime, lastModifiedDateTime, isResolved, impactDescription, posts[] }[]
```

### Layout

```text
┌─────────────────────────────────────────────────┐
│ Breadcrumb                                       │
├─────────────────────────────────────────────────┤
│ SEÇÃO 1: Contexto do Tenant                      │
│ [Tenant selector] [Status] [Atualizar][Exportar] │
│                    [Abrir Service Health]         │
├─────────────────────────────────────────────────┤
│ SEÇÃO 2: Status da Plataforma (3 cards)          │
│ [Operacionais] [Com Problemas] [Eventos Ativos]  │
├─────────────────────────────────────────────────┤
│ SEÇÃO 3: Incidentes Ativos                       │
│ [Cards por serviço com status badge]             │
├──────────────────────┬──────────────────────────┤
│ SEÇÃO 4: Serviços    │ SEÇÃO 5: Histórico       │
│ Afetados (barras)    │ (gráfico de linha)       │
├──────────────────────┴──────────────────────────┤
│ SEÇÃO 6: Lista de Incidentes (tabela)            │
│ + Sheet de detalhe lateral                       │
└─────────────────────────────────────────────────┘
```

### Mudanças Principais
1. **Seção 1**: Adicionar "Contexto do Tenant" padronizado com status de conexão, última atualização e botões (Atualizar, Exportar, Abrir Service Health) — mesmo padrão dos outros dashboards
2. **Seção 2**: Manter os 3 cards de resumo (Operacionais, Com Problemas, Eventos Ativos) com estilo glass-card e glow
3. **Seção 3**: Nova seção "Incidentes Ativos" — cards por serviço não-operacional com badge de status (Degradação, Investigando, etc.)
4. **Seção 4**: Substituir PieChart "Serviços Afetados" por barras horizontais (recharts BarChart horizontal)
5. **Seção 5**: Manter gráfico de linha (timeline), expandir para metade da largura
6. **Seção 6**: Manter tabela de incidentes + Sheet de detalhe (já funcional, só ajustar estilo)
7. **Remover** os 2 PieCharts (status e classificação)

### Detalhes Técnicos
- Reescrever como componente único (página já é autossuficiente, sem hooks customizados separados)
- Manter toda a lógica de filtros clicáveis existente
- Manter Sheet de detalhe lateral
- Usar `BarChart` horizontal do recharts para "Serviços Afetados"
- Estilo: `glass-card`, `border-border/50`, `bg-card/80`
- Botão "Abrir Service Health" → link externo `https://admin.microsoft.com/Adminportal/Home#/servicehealth`

### Arquivo a Modificar
- `src/pages/m365/M365ServiceHealthPage.tsx` — reescrever completamente

