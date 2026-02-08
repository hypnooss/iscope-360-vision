

# Plano: Corrigir Filtro de Insights do Exchange Online

## Problema

O hook `useExchangeOnlineInsights` filtra insights pela categoria, mas o filtro não inclui a categoria `threats` que é usada pelos insights de segurança do Exchange.

### Dados no Banco (8 insights)

| ID | Categoria | Nome |
|----|-----------|------|
| exo_mailbox_forwarding | email | Encaminhamento de Email |
| exo_owa_mailbox_policy | email | Política OWA |
| exo_dkim_config | email | Configuração DKIM |
| exo_anti_phish_policy | **threats** | Política Anti-Phishing |
| exo_safe_links_policy | **threats** | Safe Links |
| exo_safe_attachment_policy | **threats** | Safe Attachments |
| exo_malware_filter_policy | **threats** | Filtro de Malware |
| exo_hosted_content_filter | **threats** | Filtro de Spam |

### Filtro Atual (linha 81-88)
```typescript
.filter((insight: any) =>
  insight.category?.includes('email') ||      // ✅ Captura 3
  insight.category?.includes('exchange') ||   // ❌ Nenhum
  insight.category?.includes('mail_flow') ||  // ❌ Nenhum
  insight.category?.includes('mailbox') ||    // ❌ Nenhum
  insight.product === 'exchange'              // ❌ Nenhum
)
```

## Solução

Expandir o filtro para incluir a categoria `threats` e também usar o prefixo `exo_` no ID como critério adicional (já que todos os insights de Exchange começam com `exo_`).

### Código Corrigido
```typescript
.filter((insight: any) =>
  insight.category?.includes('email') ||
  insight.category?.includes('exchange') ||
  insight.category?.includes('mail_flow') ||
  insight.category?.includes('mailbox') ||
  insight.category?.includes('threats') ||    // NOVO: inclui threats
  insight.id?.startsWith('exo_') ||           // NOVO: qualquer insight com prefixo exo_
  insight.product === 'exchange'
)
```

## Mapeamento de Categorias

Também preciso atualizar o mapeamento de categorias para a UI (linha 91-100):

```typescript
// Mapear categoria threats para security_policies
if (insight.category === 'threats') {
  mappedCategory = 'security_policies';
}
```

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useExchangeOnlineInsights.ts` | Expandir filtro e mapeamento de categorias |

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 3 insights exibidos | 8 insights exibidos |
| Cards: 4 high, 0 medium | Cards: 4 high, 1 medium, 3 info |

## Fluxo Corrigido

```text
m365_posture_history.agent_insights (8 insights)
           ↓
useExchangeOnlineInsights
           ↓
Filtro: email OR threats OR exo_* prefix
           ↓
8 insights passam ✅
           ↓
Mapeamento de categorias
           ↓
ExchangeOnlinePage exibe todos
```

