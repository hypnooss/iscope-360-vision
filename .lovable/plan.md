

## Diagnóstico — 3 Problemas no M365 Compliance

### Problema 1: `{12}` no lugar de `12`

As `pass_description` e `fail_description` na migração de regras usam `{{count}}` (chaves duplas), mas a Edge Function `m365-security-posture` faz `.replace('{count}', ...)` (chaves simples). Resultado: `{{count}}` vira `{12}` em vez de `12`.

Regras afetadas (todas que usam `{{count}}`): ADM-003, ADM-004, ADM-005, APP-005, APP-006, APP-007.

**Fix**: Migração SQL para atualizar as `pass_description` e `fail_description` dessas regras, trocando `{{count}}` por `{count}`.

### Problema 2: Nomes das regras de credenciais precisam explicitar "de Aplicativos"

Os nomes atuais:
- APP-001: "Credenciais Expirando em 30 dias"
- APP-002: "Credenciais Expiradas"

Podem ser confundidos com credenciais de usuários.

**Fix**: Migração SQL para renomear:
- APP-001 → "Credenciais de Aplicativos Expirando em 30 dias"
- APP-002 → "Credenciais de Aplicativos Expiradas"

### Problema 3: Aba "Evidências" não aparece para itens com status `pass`

O `ComplianceDetailSheet` só exibe a aba Evidências quando `item.evidence.length > 0`. Itens com status `pass` na seção Aplicações & Integrações (e em geral) não geram evidências porque `affectedCount = 0`.

**Fix**: No `mapM365Insight` (e `mapM365AgentInsight`), sempre gerar pelo menos uma evidência básica com o `affectedCount` e a `passDescription`/`failDescription`, mesmo quando não há entidades afetadas. Isso garante que a aba Evidências apareça para todos os insights, mostrando "0 itens afetados" quando aplicável.

### Arquivos a modificar

1. **Migração SQL** — Corrigir `{{count}}` → `{count}` e renomear APP-001/APP-002
2. **`src/lib/complianceMappers.ts`** — Em `mapM365Insight` e `mapM365AgentInsight`, sempre incluir evidência base com `affectedCount`

