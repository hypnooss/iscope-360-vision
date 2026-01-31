
# Plano: Transformar Logs de Auditoria em Insights de Segurança do Entra ID

## Visao Geral

Reimplementar a area de Logs de Auditoria do modulo Microsoft 365/Entra ID para apresentar **insights de seguranca consolidados** em vez de logs crus. A nova abordagem foca em analise, correlacao e classificacao de riscos, entregando valor estrategico para tomada de decisao.

---

## Arquitetura da Solucao

```text
+------------------+     +------------------------+     +-------------------+
|   Frontend       |     |   Edge Function        |     |   Microsoft       |
|   (React)        |<--->|   entra-id-security-   |<--->|   Graph API       |
|                  |     |   insights             |     |                   |
+------------------+     +------------------------+     +-------------------+
        |                          |
        v                          v
  InsightCard               Correlacao e Analise
  InsightGrid               Classificacao de Risco
  InsightDetailDialog       Agregacao de Dados
```

---

## Fase 1: Nova Edge Function - `entra-id-security-insights`

### Objetivo
Processar logs do Entra ID internamente e retornar apenas insights consolidados, nunca logs crus.

### Insights a Implementar

#### Categoria: Seguranca de Identidade
| ID | Insight | Fonte de Dados | Severidade |
|----|---------|----------------|------------|
| SI-001 | Usuarios com logins suspeitos | signInLogs (riskState) | Alta/Critica |
| SI-002 | Multiplas tentativas falhas | signInLogs (status.errorCode) | Media |
| SI-003 | Login de paises incomuns | signInLogs (location) | Alta |
| SI-004 | Login de IPs com reputacao ruim | signInLogs + IP reputation | Alta |
| SI-005 | Login bem-sucedido apos varias falhas | Correlacao signInLogs | Critica |
| SI-006 | Usuarios sem MFA configurado | authenticationMethods | Alta |
| SI-007 | Contas privilegiadas sem MFA | directoryRoles + authMethods | Critica |
| SI-008 | Mudancas de senha seguidas de login anomalo | Correlacao auditLogs + signIn | Alta |

#### Categoria: Comportamento e Risco
| ID | Insight | Fonte de Dados | Severidade |
|----|---------|----------------|------------|
| CR-001 | Usuarios com comportamento fora do padrao | signInLogs (analise temporal) | Media |
| CR-002 | Contas inativas com permissoes elevadas | users + directoryRoles + signIn | Alta |
| CR-003 | Contas de servico com uso inesperado | servicePrincipals + signInLogs | Media |
| CR-004 | Login fora de horario padrao | signInLogs (timestamp analysis) | Baixa |

#### Categoria: Governanca e Compliance
| ID | Insight | Fonte de Dados | Severidade |
|----|---------|----------------|------------|
| GC-001 | Usuarios com funcoes administrativas | directoryRoleAssignments | Info |
| GC-002 | Alteracoes recentes em roles sensiveis | auditLogs (RoleManagement) | Alta |
| GC-003 | Usuarios recem-criados com acesso elevado | Correlacao users + roles | Alta |
| GC-004 | Funcoes atribuidas sem justificativa | auditLogs (lack of notes) | Media |

### Estrutura de Resposta da Edge Function

```typescript
interface SecurityInsight {
  id: string;
  code: string;
  title: string;
  description: string;
  category: 'identity_security' | 'behavior_risk' | 'governance';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  affectedCount: number;
  affectedUsers: Array<{
    id: string;
    displayName: string;
    userPrincipalName: string;
    details?: Record<string, unknown>;
  }>;
  criteria: string;
  recommendation: string;
  detectedAt: string;
  timeRange: { from: string; to: string };
}

interface SecurityInsightsResponse {
  success: boolean;
  insights: SecurityInsight[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  analyzedPeriod: { from: string; to: string };
  tenant: { id: string; domain: string };
}
```

---

## Fase 2: Novos Componentes React

### 2.1 `InsightCard.tsx`
Card de insight individual com:
- Icone de severidade (cores: vermelho/laranja/amarelo/azul)
- Titulo descritivo do risco
- Quantidade de usuarios afetados
- Badge de severidade
- Botao para expandir detalhes

### 2.2 `InsightDetailDialog.tsx`
Dialog modal para exibir:
- Lista de usuarios afetados
- Criterio que gerou o insight
- Recomendacao de acao
- Timeline de deteccao

### 2.3 `InsightSummaryCards.tsx`
Cards de resumo no topo da pagina:
- Total de insights
- Insights criticos
- Insights de alta prioridade
- Insights de media/baixa prioridade

### 2.4 `InsightCategorySection.tsx`
Agrupamento colapsavel por categoria:
- Seguranca de Identidade
- Comportamento e Risco
- Governanca e Compliance

---

## Fase 3: Nova Pagina - `EntraIdSecurityInsightsPage.tsx`

### Layout
```text
+-------------------------------------------------------+
|  Breadcrumb: M365 > Entra ID > Insights de Seguranca  |
+-------------------------------------------------------+
|  Header: Insights de Seguranca        [Atualizar]     |
|  Subtitle: Analise consolidada de riscos              |
+-------------------------------------------------------+
|  Tenant Info Card (se conectado)                      |
+-------------------------------------------------------+
|  Summary Cards (4 cards: Critical, High, Med, Total)  |
+-------------------------------------------------------+
|  Filtros: Periodo | Categoria | Severidade            |
+-------------------------------------------------------+
|  Categoria: Seguranca de Identidade      [Expandir]   |
|    - InsightCard 1                                    |
|    - InsightCard 2                                    |
+-------------------------------------------------------+
|  Categoria: Comportamento e Risco        [Expandir]   |
|    - InsightCard 3                                    |
+-------------------------------------------------------+
|  Categoria: Governanca e Compliance      [Expandir]   |
|    - InsightCard 4                                    |
+-------------------------------------------------------+
```

---

## Fase 4: Atualizacoes de Navegacao

### 4.1 Renomear rota e menu
- **Antes**: `/scope-m365/entra-id/audit-logs` - "Logs de Auditoria"
- **Depois**: `/scope-m365/entra-id/security-insights` - "Insights de Seguranca"

### 4.2 Atualizar `EntraIdPage.tsx`
- Alterar card de "Logs de Auditoria" para "Insights de Seguranca"
- Nova descricao: "Analise consolidada de riscos e indicadores de seguranca"

### 4.3 Atualizar `App.tsx`
- Nova rota: `/scope-m365/entra-id/security-insights`
- Redirect da rota antiga para a nova (compatibilidade)

---

## Fase 5: Hook Customizado

### `useEntraIdSecurityInsights.ts`
```typescript
interface UseEntraIdSecurityInsightsOptions {
  tenantRecordId: string | null;
  dateRange?: { from: Date; to: Date };
  categories?: string[];
  severities?: string[];
}

interface UseEntraIdSecurityInsightsResult {
  insights: SecurityInsight[];
  summary: InsightsSummary;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/entra-id-security-insights/index.ts` | Edge function de analise |
| `src/hooks/useEntraIdSecurityInsights.ts` | Hook de dados |
| `src/pages/m365/EntraIdSecurityInsightsPage.tsx` | Nova pagina |
| `src/components/m365/insights/InsightCard.tsx` | Card de insight |
| `src/components/m365/insights/InsightDetailDialog.tsx` | Dialog de detalhes |
| `src/components/m365/insights/InsightSummaryCards.tsx` | Cards de resumo |
| `src/components/m365/insights/InsightCategorySection.tsx` | Secao por categoria |
| `src/types/securityInsights.ts` | Tipos TypeScript |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Nova rota + redirect |
| `src/pages/m365/EntraIdPage.tsx` | Atualizar card de navegacao |
| `supabase/config.toml` | Registrar nova edge function |

## Arquivos a Remover/Deprecar

| Arquivo | Acao |
|---------|------|
| `src/pages/m365/EntraIdAuditLogsPage.tsx` | Remover (substituido) |
| `src/hooks/useEntraIdAuditLogs.ts` | Remover (substituido) |
| `supabase/functions/entra-id-audit-logs/` | Manter para compatibilidade interna |

---

## Criterios de Aceite

1. A tela de Insights de Seguranca nao exibe logs crus
2. Todos os dados sao apresentados como insights ou indicadores consolidados
3. Insights sao claros, acionaveis e classificados por severidade
4. Usuario consegue identificar rapidamente:
   - Quem esta em risco (lista de usuarios afetados)
   - Qual o tipo de risco (categoria + titulo)
   - Por que aquilo importa (criterio + recomendacao)
5. Linguagem executiva e orientada a risco, nao tecnica
6. Cards expansiveis para ver detalhes sem sobrecarregar a interface

---

## Estimativa de Implementacao

| Fase | Esforco |
|------|---------|
| Edge Function | Alto (logica de correlacao complexa) |
| Componentes React | Medio (reutiliza padroes existentes) |
| Nova Pagina | Baixo (composicao de componentes) |
| Atualizacoes de Navegacao | Baixo |
| Testes e Ajustes | Medio |

---

## Dependencias Externas

- Licenca Azure AD Premium P1/P2 para alguns insights (signInLogs, riskState)
- Permissoes Graph API: `AuditLog.Read.All`, `Directory.Read.All`, `Reports.Read.All`
- Permissoes ja configuradas no app M365 global

