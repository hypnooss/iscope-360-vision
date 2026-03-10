

## Refazer ExchangeCategorySheet no padrão exato do Firewall Analyzer + adicionar rankings reais

### Problema
1. O layout atual do `ExchangeCategorySheet` usa cards com Progress bars e proporções -- completamente diferente do padrão do Firewall (`AnalyzerCategorySheet`) que usa abas inline com rankings em lista (IP/domínio + contagem alinhada à direita).
2. Os dados exibidos (totais de enviados/recebidos, percentuais) são os mesmos que já aparecem no card da tela principal -- zero valor agregado.
3. Faltam rankings de Analyzer: top remetentes, top destinatários, top domínios de destino, top domínios de origem.

### Solução

**Parte 1: Backend -- Adicionar rankings de tráfego ao m365-analyzer**

No `supabase/functions/m365-analyzer/index.ts`, na função principal (onde monta `allMetrics`), adicionar um novo bloco que extrai do `exoMessageTrace`:

- `topSenders`: top 10 mailboxes que mais enviaram (user + count)
- `topRecipients`: top 10 mailboxes que mais receberam (user + count)  
- `topDestinationDomains`: top 10 domínios externos de destino (domain + count)
- `topSourceDomains`: top 10 domínios de origem dos emails recebidos (domain + count)

Salvar em `allMetrics.emailTraffic` junto com sent/received totais.

Para forwarding/auto-reply/inactive/over-quota, os dados de mailbox já existem em `exoForwarding`, `exoMailboxStats` etc. Adicionar:
- `topForwardingMailboxes`: lista de mailboxes com forwarding ativo (user + forwardTo)
- `topInactiveMailboxes`: lista de mailboxes sem login (user + lastLogin)
- `topOverQuotaMailboxes`: lista de mailboxes over quota (user + usagePct)

**Parte 2: Frontend -- Refazer ExchangeCategorySheet**

Reescrever `ExchangeCategorySheet.tsx` seguindo o padrão **exato** do `AnalyzerCategorySheet.tsx`:

- Sheet `sm:max-w-[50vw]`, `p-0 flex flex-col`
- Header com ícone em circle colorido + título + descrição (igual Firewall)
- Abas inline: `rounded-none border-b-2 border-transparent data-[state=active]:border-primary` (não TabsList com bg-muted)
- Conteúdo em `ScrollArea` com Cards contendo listas de ranking (item + contagem alinhada à direita, `border-b border-border/40`)

Layout por categoria:
- **email_traffic**: Abas "Enviados" / "Recebidos". Enviados mostra: badge total, Top Remetentes (mailboxes), Top Domínios de Destino. Recebidos mostra: badge total, Top Destinatários, Top Domínios de Origem.
- **anti_spam**: Badge total, Top Domínios Spam (de `threatProtection.topSpamSenderDomains`), Top Destinatários Spam (`topSpamRecipients`)
- **phishing**: Badge total, Top Alvos (`topPhishingTargets`), Top Domínios Remetentes (`phishing.topSenderDomains`)
- **malware**: Badge total, Top Domínios Malware (`topMalwareSenders`)
- **forwarding**: Lista de mailboxes com forwarding ativo
- **inactive_mailboxes**: Lista de mailboxes inativas
- **over_quota**: Lista de mailboxes over quota
- **auto_reply**: Lista de mailboxes com auto-reply externo

Usar componentes auxiliares `RankingList` (equivalente ao `IPList` do Firewall) para renderizar listas uniformes.

### Arquivos

1. `supabase/functions/m365-analyzer/index.ts` -- adicionar extração de rankings de tráfego e mailbox no bloco `allMetrics`
2. `src/components/m365/exchange/ExchangeCategorySheet.tsx` -- reescrever completamente no padrão Firewall
3. `src/pages/m365/ExchangeAnalyzerPage.tsx` -- ajustar props passadas ao sheet (passar `analyzerSnapshot` completo em vez de só `analyzerMetrics`)

