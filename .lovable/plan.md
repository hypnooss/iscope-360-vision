

## Corrigir status LDAP sem servidor: fail → not_found (N/A)

O problema esta em `supabase/functions/agent-task-result/index.ts` na funcao `formatLDAPEvidence`. Quando nao ha servidores LDAP configurados (`results.length === 0`), o codigo retorna `status: 'fail'`, mas o correto e retornar `'not_found'` — que o sistema ja trata como N/A.

### Alteracoes

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

1. **Linha ~2402** — `formatLDAPEvidence`: Mudar retorno de `status: 'fail'` para `status: 'not_found'` quando `results.length === 0`

2. **Linhas ~3188-3195** — Bloco de avaliacao `auth-001`: Adicionar tratamento para `status === 'not_found'`, usando `not_found_description` da regra ("Nenhum servidor LDAP configurado") como detalhes

Nenhuma alteracao de frontend necessaria — o `UnifiedComplianceCard` ja trata `not_found` como estado neutro (N/A).

