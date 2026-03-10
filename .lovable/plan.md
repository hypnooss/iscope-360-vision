

## Problemas Identificados

### 1. Mailboxes Shared ainda aparecem como inativas

O relatório CSV `getMailboxUsageDetail` da Microsoft Graph **não possui a coluna "Recipient Type"**. Os headers reais são:
```
Report Refresh Date, User Principal Name, Display Name, Is Deleted, Deleted Date, 
Created Date, Last Activity Date, Item Count, Storage Used (Byte), ...
```

O filtro `recipientType.includes('shared')` lê de uma coluna que não existe, então `recipientType` é sempre `""` e o filtro nunca exclui ninguém.

**Solução**: Usar a Graph API `GET /users?$filter=...` para obter a lista de shared/room/equipment mailboxes (via `assignedLicenses` ou `mailboxSettings`), ou mais simples: consultar `/groups` com `resourceProvisioningOptions` ou usar o endpoint dedicado. A abordagem mais prática é chamar a Graph API para listar mailboxes por tipo e criar um **Set** de UPNs de shared/room/equipment, depois usá-lo como filtro no processamento do CSV.

### 2. Barra de progresso some instantaneamente e não faz polling

O estado `triggering` é controlado pelo ciclo de vida do `Promise.all` das duas chamadas HTTP (que duram ~5-10s). Quando as chamadas HTTP terminam, `triggering` volta a `false` e a barra desaparece, mas a tarefa assíncrona do analyzer (via agent PowerShell) continua rodando por minutos.

Já existe o hook `useM365AnalyzerProgress` que faz polling a cada 30s, mas **não é usado** na `ExchangeAnalyzerPage`.

---

## Plano de Correção

### Arquivo 1: `supabase/functions/exchange-dashboard/index.ts`

- Antes de processar o CSV, fazer uma chamada Graph para listar shared/room/equipment mailboxes:
  ```
  GET /users?$filter=assignedPlans/any(...)  → complexo
  ```
  Alternativa mais simples: usar o campo **"Is Deleted"** e **"Display Name"** patterns não é confiável. A melhor abordagem é consultar a Graph API por mailbox type:
  ```
  GET /v1.0/users?$select=id,userPrincipalName,mailboxSettings&$filter=mail ne null&$top=999
  ```
  Na verdade, a forma mais direta é usar o **beta** endpoint ou filtrar por `recipientTypeDetails` via Exchange Online Management. 
  
  **Abordagem pragmática**: Chamar `GET /v1.0/groups?$filter=groupTypes/any(g:g eq 'Unified') eq false and mailEnabled eq true&$select=mail,displayName` para shared mailboxes, e `GET /v1.0/places/microsoft.graph.room` para rooms. Mas isso adiciona complexidade.

  **Abordagem mais simples e robusta**: O relatório `getMailboxUsageDetail` não distingue tipos. Vamos usar uma segunda API call para obter os UPNs de shared mailboxes via `GET /v1.0/users?$filter=userType eq 'Member'&$select=userPrincipalName,accountEnabled` e comparar com o relatório. Shared mailboxes geralmente têm `accountEnabled = false`.

  Melhor ainda: fazer `GET /v1.0/reports/getMailboxUsageDetail(period='D30')?$format=application/json` com header `Prefer: outlook.body-content-type="text/plain"`. A versão JSON pode retornar o campo `recipientType`. Porém a API de reports pode não ter esse campo.

  **Solução definitiva**: Adicionar um `console.log` com uma amostra de uma row do CSV para verificar se há algum campo que indique o tipo. Mas já vimos que não há. Então vamos usar uma abordagem de **exclusão por UPN**: 
  1. Chamar `GET /v1.0/users?$filter=accountEnabled eq false&$select=userPrincipalName&$top=999` 
  2. Chamar `GET /v1.0/groups?$filter=mailEnabled eq true and securityEnabled eq false&$select=mail&$top=999` para pegar shared mailboxes (que são representadas como groups no Entra ID com mail habilitado)

  Isso cria um Set de UPNs/mails para excluir.

### Arquivo 2: `src/pages/m365/ExchangeAnalyzerPage.tsx`

- Importar e usar `useM365AnalyzerProgress` para polling real
- Após `handleTriggerAnalysis`, manter `activeTaskId` em state
- Mostrar a barra de progresso baseada no status do polling (`pending` → 20%, `running` → 60%)
- Quando o polling retornar `completed`/`failed`/`timeout`, invalidar queries e fazer auto-refresh dos dados
- Remover a dependência do `triggering` para a barra de progresso

### Resumo das mudanças

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/exchange-dashboard/index.ts` | Adicionar chamada Graph para listar shared mailboxes e criar Set de exclusão |
| `src/pages/m365/ExchangeAnalyzerPage.tsx` | Integrar `useM365AnalyzerProgress` com polling, auto-refresh e barra de progresso real |

