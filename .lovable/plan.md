

# Padronizar cards Exchange Online com o modelo Firewall/Dominio

## Objetivo

Remover o comportamento especifico de "itens afetados" e "Como Corrigir" dos cards do Exchange Online, convertendo as mailboxes afetadas em **Evidencias Coletadas** (formato `EvidenceItem[]`), alinhando com o padrao dos modulos Firewall e Dominio Externo.

## Alteracoes

### 1. Mapper `mapExchangeInsight` (src/lib/complianceMappers.ts)

Converter `affectedMailboxes` em `evidence` (array de `EvidenceItem`) e remover `affectedEntities`/`affectedCount`:

- Criar evidencias a partir das mailboxes afetadas:
  - Uma evidencia de contagem: `{ label: "Itens afetados", value: "7 de X total", type: "text" }`
  - Uma evidencia de lista com os nomes/emails afetados: `{ label: "Mailboxes", value: "user1@..., user2@...", type: "list" }`
  - Evidencias adicionais com detalhes relevantes (forwardTo, redirectTo, etc.) quando disponiveis
- Remover `affectedEntities` e `affectedCount` do retorno
- Manter `rawData` (ja sera exibido apenas para Super Admins pelo componente unificado)
- Nao mapear `remediation` (o botao "Como Corrigir" desaparecera automaticamente)

### 2. Componente `ExoInsightCard` (src/components/m365/exchange/ExoInsightCard.tsx)

Simplificar removendo:
- O state `showDetails` e o dialog `ExoInsightDetailDialog`
- As props `onShowAffectedEntities` do `UnifiedComplianceCard`
- O componente passa a ser apenas o mapper + `UnifiedComplianceCard` sem callbacks

### 3. Mesma alteracao para SecurityInsight e ApplicationInsight

Aplicar o mesmo padrao aos outros dois mappers para consistencia:
- `mapSecurityInsight`: converter `affectedUsers` em `evidence`, remover `affectedEntities`/`affectedCount`
- `mapApplicationInsight`: converter `affectedApplications` em `evidence`, remover `affectedEntities`/`affectedCount`

## Detalhes Tecnicos

No mapper `mapExchangeInsight`, o bloco de `affectedMailboxes` sera substituido por:

```text
evidence: [
  { label: "Itens afetados", value: `${insight.affectedCount} mailbox(es)`, type: "text" },
  ...(insight.affectedMailboxes.length > 0 ? [{
    label: "Mailboxes afetadas",
    value: insight.affectedMailboxes.map(m => m.displayName || m.userPrincipalName).join('\n'),
    type: "list"
  }] : [])
],
```

O mesmo padrao sera aplicado para `SecurityInsight` (usando `affectedUsers`) e `ApplicationInsight` (usando `affectedApplications`).

Os componentes wrapper (`ExoInsightCard`, correspondentes de Security e Application) serao simplificados removendo os dialogs de entidades afetadas, ficando apenas como thin wrappers sobre `UnifiedComplianceCard`.

### Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/complianceMappers.ts` | Converter entidades em evidence nos 3 mappers |
| `src/components/m365/exchange/ExoInsightCard.tsx` | Remover dialog e callbacks |
| `src/components/m365/insights/InsightCard.tsx` | Remover dialog e callbacks (se aplicavel) |
| `src/components/m365/applications/AppInsightCard.tsx` | Remover dialog e callbacks (se aplicavel) |

