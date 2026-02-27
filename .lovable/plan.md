

## Corrigir 5 regras Fase 1 — status N/A e endpoint incorreto

### Causa Raiz

Dois problemas distintos:

1. **evaluation_logic incompativel**: As 5 novas regras (cert-001, vpn-004, fg-001, perf-001, sec-004) usam formatos `type: "array_check"`, `"object_check"`, `"threshold_check"` que `normalizeEvaluationLogic` nao reconhece (exige `field_path`). Sem `field_path`, o `source_key` sai vazio, `sourceData` e `null`, e o check cai em `status: 'unknown'` com "Dados nao disponiveis".

2. **Conflito de prefixo**: `sec-004` e capturado pelo handler `rule.code.startsWith('sec-')` (linha 3157) que chama `formatSecurityPolicyEvidence` — funcao que nao conhece `monitor_security_rating`. Idem para `vpn-004` capturado por `startsWith('vpn-')` (linha 3085).

3. **Endpoint**: `apiEndpoint` vem de `getEndpointForSourceKey` que consulta `source_key_endpoints`. Nao ha entradas para os novos source_keys, entao exibe "API do dispositivo". O campo `rule.api_endpoint` (que tem o valor correto) nunca e usado como fallback.

### Alteracoes

**Arquivo**: `supabase/functions/agent-task-result/index.ts`

1. **Adicionar handlers especificos ANTES dos handlers de prefixo** (antes da linha 3085 `startsWith('vpn-')`), para as 5 novas regras:
   - `cert-001`: Ler `rawData['monitor_certificates']`, extrair array `results`, verificar se algum tem `status === 'expired'`
   - `vpn-004`: Ler `rawData['monitor_vpn_ipsec']`, verificar se todos os tuneis estao up (nenhum down). Se array vazio → `not_found`
   - `fg-001`: Ler `rawData['monitor_fortiguard_server']`, verificar campo `connected`
   - `perf-001`: Ler `rawData['monitor_performance']`, verificar `cpu < 90` e `mem < 90`
   - `sec-004`: Ler `rawData['monitor_security_rating']`, verificar se `overall_score` existe

2. **Fallback de endpoint**: Na linha 2866, apos calcular `apiEndpoint` via `getEndpointForSourceKey`, adicionar fallback para `rule.api_endpoint`:
   ```
   if (apiEndpoint === 'API do dispositivo' && rule.api_endpoint) {
     apiEndpoint = rule.api_endpoint;
   }
   ```

3. **Deploy** da edge function `agent-task-result`

### Notas
- Os handlers especificos por codigo (`rule.code === 'cert-001'`) tem prioridade sobre handlers de prefixo (`startsWith('vpn-')`)
- Para `vpn-004` e `sec-004`, os handlers devem ser adicionados ANTES dos handlers de prefixo existentes para evitar conflito
- Para steps opcionais que retornam null (agent ainda nao coletou), o status sera `unknown` com mensagem "Dados nao disponiveis" ate o agent executar com o blueprint atualizado — este e o comportamento correto

