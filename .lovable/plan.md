
# Plano: Nova Seção Exchange Online

## Visão Geral

Criar uma nova seção **Exchange Online** no módulo Microsoft 365, seguindo **exatamente** o padrão visual e arquitetural da seção **Insights de Segurança** existente. A seção analisará riscos de segurança, configurações inseguras e desvios de boas práticas no serviço de e-mail.

---

## Análise de Permissões Necessárias

### Situação Atual

Após pesquisa detalhada, identifiquei que a **Microsoft Graph API** possui **limitações significativas** para Exchange Online:

| Funcionalidade | API Disponível | Permissão Necessária | Status |
|----------------|----------------|----------------------|--------|
| Inbox Rules (por usuário) | Graph v1.0 | `MailboxSettings.Read` | Disponível |
| Mailbox Settings | Graph v1.0 | `MailboxSettings.Read` | Disponível |
| Mailbox Delegates (Send As/Full Access) | Graph v1.0 | `MailboxSettings.Read` | Parcial |
| Mail Flow Rules (Transport) | **NÃO** | Requer PowerShell | Não disponível |
| Políticas Anti-Spam | **NÃO** | Requer PowerShell | Não disponível |
| Políticas Anti-Phishing | **NÃO** | Requer PowerShell | Não disponível |
| Conectores de Transporte | **NÃO** | Requer PowerShell | Não disponível |
| SMTP Auth Settings | **NÃO** | Requer PowerShell | Não disponível |
| Limites de Envio | **NÃO** | Requer PowerShell | Não disponível |
| Políticas de Retenção | Graph Beta | `MailboxSettings.Read` | Parcial |

### Permissões Adicionais Necessárias

Para a primeira versão via Graph API, precisaremos adicionar:

| Permissão | Tipo | Descrição |
|-----------|------|-----------|
| `MailboxSettings.Read` | Application | Ler configurações de mailbox e inbox rules |
| `Mail.Read` | Application | Ler regras de inbox (necessário para listar rules) |
| `User.Read.All` | Application | Já temos - para listar usuários |

### Limitações e Alternativas

Para as análises que requerem PowerShell (transport rules, políticas anti-spam, conectores, SMTP auth), existem duas opções futuras:

1. **Exchange Online Management API** (via OAuth) - requer configuração adicional
2. **Agente Python local** - já temos a infraestrutura, pode executar comandos PowerShell

Para a **primeira versão**, focaremos nas análises possíveis via Graph API.

---

## Análises Implementáveis na Primeira Versão

### Via Microsoft Graph API

| Código | Título | Categoria | Severidade | API |
|--------|--------|-----------|------------|-----|
| EXO-001 | Regras de redirecionamento externo | `mail_flow` | Crítico | `/users/{id}/mailFolders/inbox/messageRules` |
| EXO-002 | Regras com ações de encaminhamento | `mail_flow` | Alto | `/users/{id}/mailFolders/inbox/messageRules` |
| EXO-003 | Regras que movem para lixeira automaticamente | `mail_flow` | Médio | `/users/{id}/mailFolders/inbox/messageRules` |
| EXO-004 | Mailboxes com muitas regras de inbox | `security_hygiene` | Baixo | `/users/{id}/mailFolders/inbox/messageRules` |
| EXO-005 | Configuração de fuso horário inconsistente | `governance` | Info | `/users/{id}/mailboxSettings` |
| EXO-006 | Respostas automáticas habilitadas | `governance` | Info | `/users/{id}/mailboxSettings` |

### Roadmap Futuro (Requer PowerShell/Agent)

| Código | Título | Categoria | Dependência |
|--------|--------|-----------|-------------|
| EXO-101 | Transport Rules muito permissivas | `mail_flow` | PowerShell |
| EXO-102 | Políticas Anti-Spam fracas | `security` | PowerShell |
| EXO-103 | SMTP Auth habilitado | `security` | PowerShell |
| EXO-104 | Conectores sem TLS | `security` | PowerShell |
| EXO-105 | Usuários sem política de retenção | `governance` | PowerShell |

---

## Categorias de Insights

| Categoria | Código | Descrição | Cor |
|-----------|--------|-----------|-----|
| `mail_flow` | Fluxo de E-mail | Regras de redirecionamento e encaminhamento | Purple |
| `mailbox_access` | Acesso a Mailbox | Permissões delegadas e compartilhamento | Blue |
| `security_policies` | Políticas de Segurança | Anti-spam, anti-phishing, DLP | Red |
| `security_hygiene` | Higiene de Segurança | Configurações e boas práticas | Cyan |
| `governance` | Governança | Retenção e compliance | Emerald |

---

## Arquivos a Criar

### Tipos TypeScript

```text
src/types/exchangeInsights.ts
```

Definir:
- `ExoInsightCategory` (mail_flow, mailbox_access, security_policies, security_hygiene, governance)
- `ExoInsightSeverity` (critical, high, medium, low, info)
- `AffectedMailbox` (id, displayName, userPrincipalName, details)
- `ExchangeInsight` (id, code, title, description, category, severity, affectedCount, affectedMailboxes, criteria, recommendation, detectedAt)
- `ExoInsightsSummary`
- `ExchangeInsightsResponse`
- Constantes de cores e labels

### Edge Function

```text
supabase/functions/exchange-online-insights/index.ts
```

Fluxo:
1. Autenticar com Microsoft Graph
2. Buscar lista de usuários com mailbox
3. Para cada usuário (batch de 10):
   - Buscar inbox rules: `GET /users/{id}/mailFolders/inbox/messageRules`
   - Buscar mailbox settings: `GET /users/{id}/mailboxSettings`
4. Analisar regras de redirecionamento
5. Gerar insights categorizados
6. Retornar response padronizada

### Hook de Dados

```text
src/hooks/useExchangeOnlineInsights.ts
```

Seguir padrão do `useEntraIdSecurityInsights`:
- Estado para insights, summary, loading, error
- Função refresh para chamar edge function
- Retornar dados tipados

### Componentes de UI

```text
src/components/m365/exchange/
├── ExoInsightSummaryCards.tsx
├── ExoInsightCategorySection.tsx
├── ExoInsightCard.tsx
├── ExoInsightDetailDialog.tsx
└── index.ts
```

Reutilizar padrão visual dos componentes de `applications/` e `insights/`.

### Página Principal

```text
src/pages/m365/ExchangeOnlinePage.tsx
```

Layout idêntico a `EntraIdSecurityInsightsPage`:
- Breadcrumb
- Header com título e botão Atualizar
- Card de tenant conectado
- Summary cards no topo
- Insights por categoria (colapsáveis)
- Estados de loading, error e empty

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/App.tsx` | Adicionar rota `/scope-m365/exchange-online` |
| `src/pages/m365/M365DashboardPage.tsx` | Ativar card Exchange Online com link |
| `supabase/config.toml` | Adicionar configuração da nova edge function |

---

## Detalhes Técnicos

### Estrutura da Edge Function

```typescript
// Fluxo principal
async function main(tenantRecordId: string) {
  // 1. Buscar credenciais do tenant
  const tenant = await getTenantConfig(tenantRecordId);
  const accessToken = await getAccessToken(tenant);
  
  // 2. Buscar usuários com mailbox
  const users = await fetchUsersWithMailbox(accessToken);
  
  // 3. Buscar inbox rules para cada usuário (em batches)
  const allRules = await fetchAllInboxRules(accessToken, users);
  
  // 4. Buscar mailbox settings
  const allSettings = await fetchAllMailboxSettings(accessToken, users);
  
  // 5. Analisar e gerar insights
  const insights = [
    analyzeExternalForwarding(allRules),
    analyzeForwardingRules(allRules),
    analyzeDeleteRules(allRules),
    analyzeRuleCount(allRules),
    analyzeAutoReplies(allSettings),
  ].filter(Boolean);
  
  return { success: true, insights, summary: calculateSummary(insights) };
}
```

### API Endpoints Utilizados

```text
GET /users?$filter=mail ne null&$select=id,displayName,userPrincipalName,mail
GET /users/{id}/mailFolders/inbox/messageRules
GET /users/{id}/mailboxSettings
```

### Análise de Regras de Redirecionamento

```typescript
function analyzeExternalForwarding(rules: InboxRule[]): ExchangeInsight | null {
  const externalForwarding = rules.filter(rule => {
    const forwardTo = rule.actions?.forwardTo || [];
    const redirectTo = rule.actions?.redirectTo || [];
    
    // Verificar se redireciona para domínio externo
    const allTargets = [...forwardTo, ...redirectTo];
    return allTargets.some(target => {
      const email = target.emailAddress?.address || '';
      return !email.endsWith('@' + tenantDomain);
    });
  });
  
  if (externalForwarding.length === 0) return null;
  
  return {
    id: 'EXO-001',
    code: 'EXO-001',
    title: 'Regras de redirecionamento para domínios externos',
    description: `${externalForwarding.length} regra(s) de inbox estão redirecionando e-mails para endereços externos ao domínio da organização.`,
    category: 'mail_flow',
    severity: 'critical',
    // ...
  };
}
```

---

## Layout Visual

```text
+----------------------------------------------------------+
|                                                          |
|  [Breadcrumb] Microsoft 365 > Exchange Online            |
|                                                          |
|  EXCHANGE ONLINE                      [Atualizar]        |
|  Análise de riscos e configurações do serviço de e-mail  |
|                                                          |
|  +-------------+  +-------------+  +-------------+       |
|  | Críticos    |  | Alto Risco  |  | Médio       |      |
|  | 2           |  | 5           |  | 8           |       |
|  | insights    |  | insights    |  | insights    |       |
|  +-------------+  +-------------+  +-------------+       |
|                                                          |
|  [TENANT: contoso.onmicrosoft.com]  [Conectado]          |
|                                                          |
|  +------------------------------------------------------+|
|  | FLUXO DE E-MAIL                              3 itens ||
|  |   [Crítico: 1] [Alto: 2]                             ||
|  +------------------------------------------------------+|
|     [Card] Regras de redirecionamento externo            |
|     [Card] Regras de encaminhamento ativo                |
|                                                          |
|  +------------------------------------------------------+|
|  | HIGIENE DE SEGURANÇA                         2 itens ||
|  +------------------------------------------------------+|
|     [Card] Mailboxes com excesso de regras               |
|                                                          |
|  +------------------------------------------------------+|
|  | GOVERNANÇA                                   3 itens ||
|  +------------------------------------------------------+|
|     [Card] Respostas automáticas habilitadas             |
|                                                          |
+----------------------------------------------------------+
```

---

## Sequência de Implementação

| Etapa | Tarefa | Arquivos |
|-------|--------|----------|
| 1 | Criar tipos TypeScript | `src/types/exchangeInsights.ts` |
| 2 | Criar Edge Function | `supabase/functions/exchange-online-insights/index.ts` |
| 3 | Atualizar config.toml | `supabase/config.toml` |
| 4 | Criar hook de dados | `src/hooks/useExchangeOnlineInsights.ts` |
| 5 | Criar componentes de UI | `src/components/m365/exchange/*.tsx` |
| 6 | Criar página principal | `src/pages/m365/ExchangeOnlinePage.tsx` |
| 7 | Adicionar rota e ativar menu | `src/App.tsx`, `src/pages/m365/M365DashboardPage.tsx` |

---

## Permissões a Solicitar ao Tenant

Ao conectar um novo tenant ou reconectar, será necessário solicitar:

| Permissão | Tipo | Justificativa |
|-----------|------|---------------|
| `MailboxSettings.Read` | Application | Ler regras de inbox e configurações de mailbox |
| `Mail.Read` | Application | Necessário para acessar messageRules |

Essas permissões devem ser adicionadas à tabela `m365_required_permissions` (se existir) ou documentadas para o processo de conexão.

---

## Limitações Conhecidas

### Não Disponível via Graph API (requer PowerShell)

1. **Transport Rules (Mail Flow Rules)** - regras de transporte globais
2. **Políticas Anti-Spam** - configurações de spam filter
3. **Políticas Anti-Phishing** - proteção contra phishing
4. **Conectores de Transporte** - connectors de entrada/saída
5. **SMTP Auth Settings** - configurações de autenticação SMTP
6. **Limites de Envio** - quotas de envio por usuário
7. **Políticas de Retenção** - retention policies globais
8. **Full Access / Send As Permissions** - permissões de mailbox delegadas (parcial)

### Roadmap para Versões Futuras

Para implementar as análises acima, será necessário:

1. **Opção A**: Integrar com Exchange Online Management API (requer configuração OAuth adicional)
2. **Opção B**: Usar o Python Agent existente para executar comandos PowerShell e enviar resultados

A arquitetura do Python Agent já suporta execução de comandos remotos, podendo ser estendida para PowerShell.

---

## Cores e Estilos

### Categorias

```typescript
export const EXO_CATEGORY_COLORS: Record<ExoInsightCategory, { bg: string; text: string; border: string }> = {
  mail_flow: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-500',
    border: 'border-purple-500/30',
  },
  mailbox_access: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/30',
  },
  security_policies: {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    border: 'border-red-500/30',
  },
  security_hygiene: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-500',
    border: 'border-cyan-500/30',
  },
  governance: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-emerald-500/30',
  },
};
```

### Severidades

Reutilizar as cores padrão já definidas em `securityInsights.ts`.

---

## Resultado Esperado

- Seção "Exchange Online" acessível em `/scope-m365/exchange-online`
- Card no dashboard M365 ativo e clicável
- Layout idêntico à seção "Insights de Segurança"
- Análise de regras de inbox para todos os usuários
- Identificação de redirecionamentos externos (risco crítico)
- Cards de resumo no topo com métricas principais
- Insights agrupados por categoria (colapsáveis)
- Dialog de detalhes com lista de mailboxes afetadas
- Linguagem orientada a risco e decisão
- Preparado para expansão futura com PowerShell/Agent

---

## Nota sobre Escopo

Esta primeira versão foca nas análises possíveis via Microsoft Graph API. Para cobertura completa conforme especificado (transport rules, políticas anti-spam, conectores, SMTP auth, etc.), será necessário uma segunda fase utilizando PowerShell via Python Agent ou Exchange Online Management API.
