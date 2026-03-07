

## Diagnóstico (baseado nos logs reais)

Três problemas identificados nos logs da Edge Function:

### 1. Tráfego de Email zerado
Os headers CSV reais são `Send, Receive, Read` mas o código procura `Send Count, Receive Count`. Resultado: `parseInt('undefined')` = 0.

### 2. Mailbox Settings (forwarding/auto-reply) zerado
A query `$filter=assignedLicenses/$count ne 0&$count=true` falha com 400 (erro de tipo complexo). A fallback existe mas não está sendo executada corretamente — o fluxo cai no catch principal mas o log mostra "Users for mailbox settings check: 0" do bloco primário, indicando que `graphGetAllPages` retorna array vazio (não lança exceção) porque `graphGet` retorna `null` em caso de erro.

### 3. Dados de Segurança hardcoded
Os valores de phishing/malware/spam estão hardcoded como 0. Não há chamada à API.

## Solução

Editar `supabase/functions/exchange-dashboard/index.ts`:

1. **Corrigir nomes dos campos CSV**: `Send` e `Receive` (sem "Count")
2. **Corrigir query de usuários**: Usar query simples `$select=id&$top=100` como primária (sem `$filter`/`$count`)
3. **Adicionar coleta de segurança**: Usar `reports/getEmailActivityCounts` que já retorna dados e adicionar `security/alerts_v2` para ameaças de email, ou usar os relatórios beta `getMailDetailSpamReport`/`getMailDetailPhishReport`/`getMailDetailMalwareReport` que retornam contagens detalhadas por tipo de ameaça

Após edição, fazer redeploy da função.

### Arquivos modificados
- `supabase/functions/exchange-dashboard/index.ts`

