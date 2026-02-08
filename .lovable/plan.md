
# Plano: Unificação de Categorias M365 - Exchange Online

## Objetivo

Usar as **mesmas categorias do relatório** (`M365RiskCategory`) nas páginas de produto (Exchange Online, Entra ID, etc.), garantindo consistência visual e conceitual.

## Situação Atual

### Duas definições de categorias

| Sistema | Arquivo | Categorias | Uso |
|---------|---------|------------|-----|
| Relatório | `m365Insights.ts` | 11 categorias (`identities`, `email_exchange`, `threats_activity`, etc.) | Relatório Web e PDF |
| Exchange | `exchangeInsights.ts` | 5 categorias (`mail_flow`, `security_policies`, etc.) | Página Exchange Online |

### Problema

O usuário vê categorias diferentes na página Exchange Online vs. o Relatório, causando confusão:

```text
Página Exchange Online:        Relatório de Postura:
──────────────────────────     ─────────────────────
• Fluxo de E-mail              • Email & Exchange
• Políticas de Segurança       • Ameaças & Atividades
• Higiene de Segurança         • Governança (PIM)
• Governança                   
```

---

## Solução

### Nova Arquitetura

```text
┌─────────────────────────────────────────────────────────────────┐
│                    M365RiskCategory (ÚNICA FONTE)               │
│                                                                 │
│  identities | auth_access | admin_privileges | apps_integrations│
│  email_exchange | threats_activity | intune_devices | ...       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │Exchange │    │Entra ID │    │Relatório│
   │  Page   │    │  Page   │    │Web/PDF  │
   └─────────┘    └─────────┘    └─────────┘
        │              │              │
   Filtra por      Filtra por    Exibe todas
   product=        product=      as categorias
   exchange_online  entra_id
```

### Mapeamento para Exchange

Os insights do Exchange usarão as categorias do relatório:

| Insight | Categoria Atual | Categoria Nova |
|---------|-----------------|----------------|
| Encaminhamento de Email | `mail_flow` | **`email_exchange`** |
| Configuração DKIM | `security_hygiene` | **`email_exchange`** |
| Regras de Transporte | `mail_flow` | **`email_exchange`** |
| Política Anti-Phishing | `threats` | **`threats_activity`** |
| Safe Links | `threats` | **`threats_activity`** |
| Safe Attachments | `threats` | **`threats_activity`** |
| Filtro de Malware | `threats` | **`threats_activity`** |
| Filtro de Spam | `threats` | **`threats_activity`** |
| Remote Domains | `governance` | **`pim_governance`** |
| Política OWA | `governance` | **`pim_governance`** |

---

## Arquivos a Modificar

### 1. Edge Function: Atualizar categorias geradas

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

Alterar a função `processM365AgentInsights` para usar categorias corretas:

```typescript
// ANTES
if (rawData['exo_anti_phish_policy']) {
  insights.push({
    category: 'threats',  // categoria genérica
    ...
  });
}

// DEPOIS
if (rawData['exo_anti_phish_policy']) {
  insights.push({
    category: 'threats_activity',  // categoria do relatório
    product: 'exchange_online',
    ...
  });
}
```

### 2. Hook: Atualizar filtro e mapeamento

**Arquivo:** `src/hooks/useExchangeOnlineInsights.ts`

- Remover mapeamento de categorias (usar diretamente `M365RiskCategory`)
- Filtrar insights por `product === 'exchange_online'`
- Retornar tipo `M365Insight` em vez de `ExchangeInsight`

### 3. Página: Usar componente unificado

**Arquivo:** `src/pages/m365/ExchangeOnlinePage.tsx`

- Usar `M365CategorySection` em vez de `ExoInsightCategorySection`
- Remover importação de tipos específicos do Exchange
- Filtrar apenas categorias relevantes para Exchange

### 4. Tipos: Simplificar

**Arquivo:** `src/types/exchangeInsights.ts`

- Marcar como **deprecated** ou remover
- Manter apenas tipos específicos como `AffectedMailbox` se necessário

---

## Benefícios

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Categorias | 2 sistemas (11 + 5) | 1 sistema (11) |
| Consistência | Confuso | Idêntico |
| Manutenção | Duplicada | Centralizada |
| UX | Categorias diferentes por página | Mesmo visual em todo lugar |

---

## Detalhes Técnicos

### Categorias relevantes para Exchange

Das 11 categorias, apenas 3 serão exibidas na página Exchange:

```typescript
const EXCHANGE_CATEGORIES: M365RiskCategory[] = [
  'email_exchange',      // Fluxo, DKIM, regras
  'threats_activity',    // Anti-phish, Safe Links, etc.
  'pim_governance',      // Remote domains, OWA
];
```

### Nova estrutura da página Exchange

```typescript
// ExchangeOnlinePage.tsx
const exchangeInsights = insights.filter(
  i => i.product === 'exchange_online'
);

const insightsByCategory = {
  email_exchange: exchangeInsights.filter(i => i.category === 'email_exchange'),
  threats_activity: exchangeInsights.filter(i => i.category === 'threats_activity'),
  pim_governance: exchangeInsights.filter(i => i.category === 'pim_governance'),
};

return (
  <>
    <M365CategorySection 
      category="email_exchange" 
      label={CATEGORY_LABELS.email_exchange}
      insights={insightsByCategory.email_exchange} 
    />
    <M365CategorySection 
      category="threats_activity" 
      label={CATEGORY_LABELS.threats_activity}
      insights={insightsByCategory.threats_activity} 
    />
    <M365CategorySection 
      category="pim_governance" 
      label={CATEGORY_LABELS.pim_governance}
      insights={insightsByCategory.pim_governance} 
    />
  </>
);
```

---

## Ordem de Implementação

1. **Backend**: Atualizar `agent-task-result` para gerar categorias corretas (`email_exchange`, `threats_activity`, `pim_governance`)

2. **Hook**: Modificar `useExchangeOnlineInsights` para usar `M365RiskCategory`

3. **Página**: Atualizar `ExchangeOnlinePage` para usar `M365CategorySection`

4. **Limpeza**: Remover/depreciar tipos específicos do Exchange

5. **Teste**: Executar nova análise e verificar consistência visual

---

## Resultado Final

Ao abrir a página **Exchange Online** ou o **Relatório de Postura**, o usuário verá:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Email & Exchange                                      90%       │
├─────────────────────────────────────────────────────────────────┤
│ ✓ Encaminhamento de Email Configurado                          │
│ ✓ DKIM Habilitado                                              │
│ ✓ Regras de Transporte Seguras                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Ameaças & Atividades Suspeitas                        75%       │
├─────────────────────────────────────────────────────────────────┤
│ ✓ Política Anti-Phishing Configurada                           │
│ ✓ Safe Links Habilitado                                        │
│ ⚠ Safe Attachments Desabilitado                   [Alto]       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PIM & Governança                                     100%       │
├─────────────────────────────────────────────────────────────────┤
│ ✓ Remote Domains Configurados                                  │
│ ✓ Política OWA Segura                                          │
└─────────────────────────────────────────────────────────────────┘
```

A diferença entre as páginas será apenas o **filtro aplicado**:
- **Exchange Online**: Apenas insights com `product: 'exchange_online'`
- **Relatório**: Todos os insights, organizados por categoria
