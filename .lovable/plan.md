

## Problema

Os logs mostram que **nenhuma** das fontes de dados de segurança funciona:
- `security/alerts_v2` retorna null (sem permissão ou sem Defender ativo)
- `getMailDetailSpamReport/PhishReport/MalwareReport` retornam 400 "Resource not found" (endpoints inexistentes na Graph API)

Porém, o **M365 Analyzer** já coleta esses dados via PowerShell (`exoMessageTrace`) e armazena em `m365_analyzer_snapshots.metrics.threatProtection` com campos: `spamBlocked`, `phishingDetected`, `malwareBlocked`, `quarantined`.

## Solução

Modificar `supabase/functions/exchange-dashboard/index.ts` para **ler os dados de segurança do snapshot mais recente do analyzer** em vez de tentar endpoints da Graph API que não funcionam.

### Mudanças

1. **Remover** as chamadas a `security/alerts_v2` e os fallbacks beta do fetch paralelo
2. **Adicionar** query ao Supabase para buscar o último `m365_analyzer_snapshots` do tenant com status `completed`, extraindo `metrics.threatProtection`
3. **Mapear** os campos:
   - `spamBlocked` → `spam`
   - `phishingDetected` → `phishing`
   - `malwareBlocked` → `malware`
   - `maliciousInbound` = `phishing + malware`
4. **Redeploy** da edge function

### Arquivo modificado
- `supabase/functions/exchange-dashboard/index.ts`

