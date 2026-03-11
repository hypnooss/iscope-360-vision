

## Plano: Paralelizar processamento no run-scheduled-analyses

### Problema confirmado
A Edge Function `run-scheduled-analyses` processa 6 seções **sequencialmente**. Com ~140 agendamentos (54 FW compliance + 54 FW analyzer + 14 domínios + 16 attack surface) processados antes do M365 Compliance, a função **excede o timeout** nos horários de pico e nunca chega a disparar as tarefas de M365 Compliance.

### Solução
Refatorar a Edge Function para processar todas as 6 seções **em paralelo** usando `Promise.all`. Cada seção já é independente — usa tabelas diferentes e dispara funções diferentes.

### Mudanças em `supabase/functions/run-scheduled-analyses/index.ts`

1. **Extrair cada seção para uma função async separada**:
   - `processFirewallComplianceSchedules(supabase, supabaseUrl, serviceKey)`
   - `processExternalDomainSchedules(supabase, supabaseUrl, serviceKey)`
   - `processAnalyzerSchedules(supabase, supabaseUrl, serviceKey)`
   - `processAttackSurfaceSchedules(supabase, supabaseUrl, serviceKey)`
   - `processM365AnalyzerSchedules(supabase, supabaseUrl, serviceKey)`
   - `processM365ComplianceSchedules(supabase, supabaseUrl, serviceKey)`

2. **Executar todas em paralelo**:
```typescript
const [fwResult, domainResult, analyzerResult, attackResult, m365AnalyzerResult, m365ComplianceResult] = 
  await Promise.all([
    processFirewallComplianceSchedules(supabase, url, key),
    processExternalDomainSchedules(supabase, url, key),
    processAnalyzerSchedules(supabase, url, key),
    processAttackSurfaceSchedules(supabase, url, key),
    processM365AnalyzerSchedules(supabase, url, key),
    processM365ComplianceSchedules(supabase, url, key),
  ]);
```

3. **Manter o CVE refresh sequencial** (após o Promise.all, como hoje)

4. **Cada função retorna** `{ triggered, skipped, errors }` para o log final de breakdown

### Impacto
- **M365 Compliance** será processado independentemente dos firewalls
- A execução total será significativamente mais rápida (paralela)
- Zero mudança na lógica interna de cada seção — apenas reorganização estrutural
- Apenas 1 arquivo alterado: `supabase/functions/run-scheduled-analyses/index.ts`

