
# Plano: Modelo Assíncrono de Análise M365 (Padrão Firewall/Domínio Externo)

## Problema Identificado

A análise M365 atual funciona em **tempo real sincronamente**:
1. Usuário clica "Atualizar" 
2. Edge Function executa 57+ verificações via Graph API
3. Resposta demora 30-60s (ou timeout)
4. Sem histórico persistido
5. Performance comprometida na experiência do usuário

## Solução Proposta

Migrar para o modelo assíncrono já usado em **Domínio Externo** e **Firewall**:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Tela de Análise │     │  Edge Function   │     │ Tabela de Histórico │
│ (Iniciar)       │ ──> │  (Trigger Task)  │ ──> │ m365_posture_history│
└─────────────────┘     └──────────────────┘     └─────────────────────┘
         │                                                 │
         v                                                 v
┌─────────────────┐                            ┌─────────────────────┐
│ Tela Execuções  │ <────── polling ──────────>│ Tela de Relatórios  │
│ (Monitorar)     │                            │ (Visualizar)        │
└─────────────────┘                            └─────────────────────┘
```

---

## Arquitetura de Páginas

### Páginas a Criar

| Página | Arquivo | Descrição |
|--------|---------|-----------|
| **Análise M365** | `M365AnalysisPage.tsx` | Tela inicial para selecionar tenant e iniciar análise |
| **Execuções M365** | `M365ExecutionsPage.tsx` | Monitoramento de tarefas em andamento |
| **Relatórios M365** | `M365ReportsPage.tsx` | Histórico de análises com seletor de versão |
| **Relatório Detalhe** | `M365PostureReportPage.tsx` | Visualização do relatório (refatorar da atual) |

### Fluxo do Usuário

1. **Análise M365**: Usuário seleciona tenant e clica "Iniciar Análise"
2. **Execuções M365**: Tarefa aparece como "Pendente" → "Executando" → "Concluída"
3. **Relatórios M365**: Usuário acessa histórico e visualiza relatórios

---

## Banco de Dados

### Nova Tabela: `m365_posture_history`

```sql
CREATE TABLE m365_posture_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_record_id UUID NOT NULL REFERENCES m365_tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  score INTEGER NOT NULL,
  classification TEXT NOT NULL,
  summary JSONB NOT NULL,
  category_breakdown JSONB NOT NULL,
  insights JSONB NOT NULL,
  errors JSONB,
  analyzed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_m365_posture_history_tenant ON m365_posture_history(tenant_record_id);
CREATE INDEX idx_m365_posture_history_client ON m365_posture_history(client_id);
CREATE INDEX idx_m365_posture_history_created ON m365_posture_history(created_at DESC);
```

### Novo Tipo de Tarefa

Adicionar ao enum `agent_task_type`:
```sql
ALTER TYPE agent_task_type ADD VALUE 'm365_posture_analysis';
```

**Nota**: Como a análise M365 não usa agent local (usa Graph API direto), precisamos de uma abordagem diferente. A Edge Function será a "executora", e usaremos uma tabela de jobs ou chamaremos diretamente.

---

## Edge Functions

### 1. `trigger-m365-posture-analysis` (Nova)

Dispara a análise e cria registro na tabela de jobs/histórico com status "pending":

```typescript
// Fluxo:
1. Receber tenant_record_id
2. Verificar se já existe análise pendente (prevenir duplicatas)
3. Criar registro em m365_posture_history com status 'pending'
4. Chamar m365-security-posture em background
5. Retornar job_id imediatamente
```

**Alternativa (mais simples)**: A Edge Function `m365-security-posture` já faz a coleta - só precisa **persistir** o resultado na nova tabela.

### 2. `m365-security-posture` (Modificar)

Adicionar opção para persistir resultado:

```typescript
// Novo parâmetro: persist_result: boolean
if (persist_result) {
  // Salvar em m365_posture_history
  await supabase.from('m365_posture_history').insert({
    tenant_record_id,
    client_id,
    score,
    classification,
    summary,
    category_breakdown: categoryBreakdown,
    insights,
    errors,
    analyzed_by: user_id,
  });
}
```

---

## Componentes de UI

### M365AnalysisPage.tsx

```
┌────────────────────────────────────────────────────────┐
│  Análise de Postura de Segurança                       │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Selecione o Tenant:                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ▼ Contoso Corp (contoso.onmicrosoft.com)        │  │
│  │   Fabrikam Inc (fabrikam.com)                   │  │
│  │   Acme Corp (acme.onmicrosoft.com)              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  [Última análise: 15/01/2026 às 14:30 - Score: 72%]    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                 🔒 Iniciar Análise               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Nota: A análise pode levar alguns minutos.            │
│  Acompanhe o progresso em "Execuções".                 │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### M365ExecutionsPage.tsx

Seguir exatamente o padrão de `ExternalDomainExecutionsPage.tsx`:
- Cards de estatísticas (Total, Pendentes, Executando, Concluídas, Falhas)
- Tabela com status em tempo real (polling 10s)
- Filtros por período e status
- Detalhes da execução em modal

### M365ReportsPage.tsx

Seguir exatamente o padrão de `ExternalDomainReportsPage.tsx`:
- Filtro por workspace/tenant
- Tabela agrupada por tenant
- Seletor de versão da análise (dropdown de datas)
- Botões Ver e Exportar PDF

---

## Navegação

### Menu M365 Atualizado

```
Microsoft 365
├── Dashboard
├── Análise          <── Nova (iniciar análise)
├── Execuções        <── Nova (monitorar)
├── Relatórios       <── Nova (histórico)
├── Entra ID
│   ├── Security Insights
│   └── Application Insights
├── Exchange Online
└── Conexão de Tenant
```

---

## Arquivos a Criar/Modificar

### Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/m365/M365AnalysisPage.tsx` | Tela de iniciar análise |
| `src/pages/m365/M365ExecutionsPage.tsx` | Monitoramento de execuções |
| `src/pages/m365/M365ReportsPage.tsx` | Histórico de relatórios |
| `src/pages/m365/M365PostureReportPage.tsx` | Visualização do relatório |
| `supabase/functions/trigger-m365-posture-analysis/index.ts` | Trigger da análise |
| Migration SQL para `m365_posture_history` | Tabela de histórico |

### Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/m365-security-posture/index.ts` | Adicionar persistência |
| `src/App.tsx` | Adicionar novas rotas |
| `src/components/layout/AppLayout.tsx` | Atualizar menu M365 |
| `supabase/config.toml` | Registrar nova Edge Function |

### Deprecar (manter temporariamente)

| Arquivo | Status |
|---------|--------|
| `src/pages/m365/M365PosturePage.tsx` | Será substituída pelo novo fluxo |

---

## Considerações sobre Preview Mode

Todas as novas páginas seguirão o padrão existente:
- Filtro por `previewTarget.workspaces` ao buscar dados
- `usePreviewGuard()` para bloquear ação "Iniciar Análise"
- Banner visual já existente no AppLayout

---

## Ordem de Implementação

1. **Criar tabela** `m365_posture_history` (migration SQL)
2. **Modificar** `m365-security-posture` para persistir resultados
3. **Criar** `trigger-m365-posture-analysis` (opcional, se quiser async completo)
4. **Criar** `M365AnalysisPage.tsx` (selecionar tenant e iniciar)
5. **Criar** `M365ReportsPage.tsx` (listar histórico)
6. **Criar** `M365PostureReportPage.tsx` (visualizar relatório - refatorar atual)
7. **Criar** `M365ExecutionsPage.tsx` (se usar modelo de jobs)
8. **Atualizar** rotas e navegação

---

## Benefícios da Mudança

| Aspecto | Antes (Tempo Real) | Depois (Assíncrono) |
|---------|-------------------|---------------------|
| **Performance** | Bloqueio de 30-60s | Retorno imediato |
| **Histórico** | Sem persistência | Snapshots completos |
| **Comparação** | Impossível | Tendência de score |
| **UX** | Ansiedade de espera | Acompanhamento claro |
| **Timeout** | Risco de falha | Retry automático |
| **Seleção de Tenant** | No mesmo lugar | Tela dedicada |

---

## Resultado Esperado

- Fluxo idêntico ao de Domínio Externo e Firewall
- Histórico persistido com todas as análises
- Performance melhorada sem bloqueio de UI
- Seleção clara de tenant antes de iniciar
- Possibilidade futura de agendamento automático
