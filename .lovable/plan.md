
# Adicionar 'success' à Constraint de Severity

## Objetivo

Expandir a constraint `valid_severity` da tabela `system_alerts` para incluir o valor `'success'`, permitindo que o edge function `agent-task-result` crie alertas de análise concluída com sucesso.

## Situação Atual

**Constraint existente:**
```sql
CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text])))
```

**Problema:** O edge function `agent-task-result` tenta inserir alertas com `severity: 'success'`, mas a constraint atual só permite `info`, `warning` e `error`.

## Alteração Necessária

### Migração SQL

```sql
-- Remove a constraint existente
ALTER TABLE public.system_alerts DROP CONSTRAINT valid_severity;

-- Recria com o novo valor 'success'
ALTER TABLE public.system_alerts 
ADD CONSTRAINT valid_severity 
CHECK (severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'success'::text]));
```

## Impacto

- **Edge function**: Permitirá que alertas de `firewall_analysis_completed` sejam salvos corretamente
- **Frontend**: O `SystemAlertBanner` já trata `success` com estilo verde/teal
- **Backwards compatible**: Não afeta alertas existentes

## Verificação Pós-Migração

Após a migração, uma nova análise do firewall SAO-FW deverá:
1. Salvar o resultado em `analysis_history`
2. Criar alerta em `system_alerts` com severity `success`
3. Atualizar `last_score` e `last_analysis_at` na tabela `firewalls`
