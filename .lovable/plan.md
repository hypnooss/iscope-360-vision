
# Plano: Reorganização do Módulo Microsoft 365

## Resumo Executivo

Três pontos precisam ser resolvidos:
1. **Telas não devem fazer consultas em tempo real** - devem exibir dados já coletados
2. **Comandos PowerShell estão dando timeout** - especificamente `exo_inbox_rules` 
3. **Segmentação de blueprints por produto** - avaliar impacto na performance

---

## Análise da Situação Atual

### 1. Telas que fazem consultas em tempo real

| Tela | Hook | Comportamento Atual |
|------|------|---------------------|
| Exchange Online | `useExchangeOnlineInsights` | Chama `exchange-online-insights` edge function ao carregar |
| Entra ID Security Insights | `useEntraIdSecurityInsights` | Chama `entra-id-security-insights` ao carregar |
| Entra ID Application Insights | `useEntraIdApplicationInsights` | Chama `entra-id-application-insights` ao carregar |
| Postura de Segurança | `useM365SecurityPosture` | Dispara `trigger-m365-posture-analysis` e faz polling |

Todas essas telas fazem análise sob demanda - cada visualização gera tráfego de API para Microsoft Graph.

### 2. Comandos PowerShell com Timeout

Analisando os erros recentes:
```
exo_inbox_rules: Execution timed out after 300 seconds
```

O comando problemático é:
```powershell
Get-Mailbox -ResultSize Unlimited | ForEach-Object { 
  Get-InboxRule -Mailbox $_.PrimarySmtpAddress -ErrorAction SilentlyContinue | 
  Where-Object { $_.ForwardTo -or $_.ForwardAsAttachmentTo -or $_.RedirectTo } | 
  Select-Object MailboxOwnerId, Name, ForwardTo, ForwardAsAttachmentTo, RedirectTo, Enabled 
}
```

Este comando itera sobre **todas as mailboxes** (potencialmente milhares) e executa `Get-InboxRule` para cada uma - causa de timeout garantida.

### 3. Segmentação de Blueprints

Atualmente existem 2 blueprints M365:
- **Edge Function** (`m365-security-posture`): 39 steps via Graph API
- **Agent** (`M365 - Exchange & SharePoint (Agent)`): 16 steps via PowerShell

Ambos são executados em uma única tarefa cada, o que significa:
- Uma falha em qualquer step pode comprometer toda a coleta
- Não há granularidade para análise por produto

---

## Proposta de Solução

### Parte 1: Modelo de Dados Coletados (Como Firewall)

Migrar as telas para o modelo de **snapshot estático**, igual ao utilizado em Firewall:

```text
ANTES:
┌──────────────────────────────────────────────────────────────┐
│  Usuário abre Exchange Online                                │
│          │                                                   │
│          ▼                                                   │
│  useExchangeOnlineInsights.refresh()                         │
│          │                                                   │
│          ▼                                                   │
│  supabase.functions.invoke('exchange-online-insights')       │
│          │                                                   │
│          ▼ (API calls em tempo real)                         │
│  Microsoft Graph API                                         │
└──────────────────────────────────────────────────────────────┘

DEPOIS:
┌──────────────────────────────────────────────────────────────┐
│  Usuário abre Exchange Online                                │
│          │                                                   │
│          ▼                                                   │
│  Busca último registro de m365_posture_history               │
│          │                                                   │
│          ▼                                                   │
│  Exibe dados já coletados (snapshot estático)                │
│                                                              │
│  [Botão "Reanalisar"] → trigger-m365-posture-analysis        │
└──────────────────────────────────────────────────────────────┘
```

### Parte 2: Otimização dos Comandos PowerShell

Substituir comandos que iteram sobre todas as mailboxes por versões mais eficientes:

| Comando | Problema | Solução |
|---------|----------|---------|
| `exo_inbox_rules` | Itera todas as mailboxes | Usar amostragem ou limitar a mailboxes de risco |
| `exo_mailbox_permissions` | Itera todas as mailboxes | Usar `Get-RecipientPermission` com filtro |
| `exo_mailbox_forwarding` | OK, mas pode ser otimizado | Adicionar `-Filter` se possível |

Exemplo de comando otimizado para `exo_inbox_rules`:
```powershell
# ANTES: Get-Mailbox -ResultSize Unlimited | ForEach-Object { Get-InboxRule ... }
# DEPOIS: Usar cmdlet direto com filtro
Get-TransportRule | Where-Object { $_.RedirectMessageTo -or $_.CopyTo -or $_.BlindCopyTo } | 
  Select-Object Name, State, RedirectMessageTo, CopyTo, BlindCopyTo
```

### Parte 3: Segmentação de Blueprints por Produto

Sim, segmentar blueprints por produto trará benefícios:

```text
ANTES (1 blueprint Edge + 1 Agent):
┌─────────────────────────────────────────────────────────────┐
│  M365 - Postura de Segurança (39 steps)                     │
│  M365 - Exchange & SharePoint (16 steps)                    │
└─────────────────────────────────────────────────────────────┘

DEPOIS (Blueprints segmentados):
┌─────────────────────────────────────────────────────────────┐
│  EntraID (Edge)     │ 20 steps: users, roles, MFA, CA policies, auth      │
│  Exchange (Agent)       │ 8 steps: mailbox, rules          │
│  SharePoint (Edge)      │ 5 steps: sites, sharing          │
│  Teams (Edge)  │ X steps: teams       │
│  Defender (Edge)  │ X steps: defender
└─────────────────────────────────────────────────────────────┘
```

Benefícios:
1. **Isolamento de falhas**: timeout no Exchange não afeta Identidades
2. **Execução paralela**: cada blueprint pode rodar independentemente
3. **Cache granular**: página de Identidades pode usar cache de Identidades
4. **Performance na UI**: cada página carrega apenas seus dados

---

## Implementação Detalhada

### Fase 1: Armazenar insights por produto na `m365_posture_history`

Adicionar colunas para armazenar insights segmentados:

```sql
ALTER TABLE m365_posture_history
ADD COLUMN exchange_insights jsonb DEFAULT NULL,
ADD COLUMN entra_id_insights jsonb DEFAULT NULL,
ADD COLUMN applications_insights jsonb DEFAULT NULL,
ADD COLUMN sharepoint_insights jsonb DEFAULT NULL,
ADD COLUMN teams_insights jsonb DEFAULT NULL;
```

Ou manter a estrutura atual e adicionar um campo `product` nos insights:
```json
{
  "insights": [
    { "id": "...", "product": "exchange", ... },
    { "id": "...", "product": "entra_id", ... }
  ]
}
```

### Fase 2: Refatorar hooks para buscar dados do histórico

**Antes** (faz chamada de API):
```typescript
// useExchangeOnlineInsights.ts
const refresh = async () => {
  const { data } = await supabase.functions.invoke('exchange-online-insights', ...);
  setInsights(data.insights);
};
```

**Depois** (busca do banco):
```typescript
// useExchangeOnlineInsights.ts
const { data: latestAnalysis } = useQuery({
  queryKey: ['m365-exchange-insights', tenantRecordId],
  queryFn: async () => {
    const { data } = await supabase
      .from('m365_posture_history')
      .select('insights, agent_insights, created_at')
      .eq('tenant_record_id', tenantRecordId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    // Filtrar insights do Exchange
    const exchangeInsights = data.insights.filter(i => 
      i.category?.includes('email') || i.product === 'exchange'
    );
    
    return { insights: exchangeInsights, analyzedAt: data.created_at };
  }
});
```

### Fase 3: Otimizar blueprint do Agent

Atualizar o blueprint `e276576e-0de0-4463-a0ee-940b970c4f69` com comandos otimizados:

```json
{
  "steps": [
    {
      "id": "exo_inbox_rules",
      "type": "powershell",
      "params": {
        "module": "ExchangeOnline",
        "timeout": 120,
        "commands": [{
          "name": "exo_inbox_rules",
          "command": "Get-InboxRule -Mailbox (Get-Mailbox -ResultSize 50 | Where-Object { $_.RecipientTypeDetails -eq 'UserMailbox' }).PrimarySmtpAddress -ErrorAction SilentlyContinue | Where-Object { $_.ForwardTo -or $_.RedirectTo } | Select-Object MailboxOwnerId, Name, ForwardTo, RedirectTo, Enabled"
        }]
      }
    }
  ]
}
```

### Fase 4: Adicionar botão "Reanalisar" nas páginas

Cada página terá um botão no header:

```typescript
// ExchangeOnlinePage.tsx
<Button onClick={triggerReanalysis} disabled={isAnalyzing}>
  <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
  Reanalisar
</Button>

const triggerReanalysis = async () => {
  await supabase.functions.invoke('trigger-m365-posture-analysis', {
    body: { tenant_record_id: selectedTenantId }
  });
  // Recarregar após análise completa
};
```

---

## Arquivos a Modificar

### Migração SQL
| Arquivo | Alteração |
|---------|-----------|
| Nova migração | Atualizar blueprint com comandos otimizados |

### Hooks
| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useExchangeOnlineInsights.ts` | Buscar de `m365_posture_history` em vez de chamar API |
| `src/hooks/useEntraIdSecurityInsights.ts` | Buscar de `m365_posture_history` em vez de chamar API |
| `src/hooks/useEntraIdApplicationInsights.ts` | Buscar de `m365_posture_history` em vez de chamar API |
| `src/hooks/useM365SecurityPosture.ts` | Remover trigger automático, apenas buscar último registro |

### Páginas
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/m365/ExchangeOnlinePage.tsx` | Remover `refresh()` automático, adicionar botão "Reanalisar" |
| `src/pages/m365/EntraIdSecurityInsightsPage.tsx` | Idem |
| `src/pages/m365/EntraIdApplicationInsightsPage.tsx` | Idem |
| `src/pages/m365/M365PosturePage.tsx` | Idem |

### Edge Functions (opcional, fase futura)
| Arquivo | Alteração |
|---------|-----------|
| `trigger-m365-posture-analysis` | Persistir insights por produto |
| `m365-security-posture` | Taguear insights com `product` |

---

## Comandos PowerShell Otimizados

### 1. `exo_inbox_rules` (CRÍTICO - causa timeout)
```powershell
# ANTES: Itera TODAS as mailboxes
Get-Mailbox -ResultSize Unlimited | ForEach-Object { Get-InboxRule ... }

# DEPOIS: Amostragem de 100 mailboxes mais recentes
Get-Mailbox -ResultSize 100 -SortBy WhenMailboxCreated | ForEach-Object { 
  Get-InboxRule -Mailbox $_.PrimarySmtpAddress -ErrorAction SilentlyContinue | 
  Where-Object { $_.ForwardTo -or $_.ForwardAsAttachmentTo -or $_.RedirectTo } | 
  Select-Object MailboxOwnerId, Name, ForwardTo, ForwardAsAttachmentTo, RedirectTo, Enabled 
}
```

### 2. `exo_mailbox_permissions` (CRÍTICO - causa timeout)
```powershell
# ANTES: Itera TODAS as mailboxes
Get-Mailbox -ResultSize Unlimited | Get-MailboxPermission | ...

# DEPOIS: Usar Get-RecipientPermission com filtro
Get-RecipientPermission -ResultSize 500 | 
  Where-Object { $_.Trustee -ne "NT AUTHORITY\SELF" } | 
  Select-Object Identity, Trustee, AccessRights
```

### 3. Remover steps redundantes
Alguns steps podem ser consolidados ou removidos:
- `exo_malware_filter_policy` → já coberto pelo Graph API
- `exo_hosted_content_filter` → já coberto pelo Graph API

---

## Benefícios Esperados

1. **Performance**: Páginas carregam instantaneamente (dados em cache)
2. **Estabilidade**: Timeouts no Agent não afetam a UI
3. **Consistência**: Mesmo modelo usado em Firewall e Domínios Externos
4. **UX**: Usuário sabe quando está vendo dados antigos e pode solicitar atualização

---

## Ordem de Implementação Sugerida

1. **Imediato**: Otimizar comandos PowerShell (resolver timeouts)
2. **Fase 1**: Refatorar hooks para buscar do histórico
3. **Fase 2**: Atualizar páginas com botão "Reanalisar"
4. **Fase 3**: Segmentar blueprints por produto (se necessário)
