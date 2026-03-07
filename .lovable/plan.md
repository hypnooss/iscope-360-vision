

## Correção: Tenant 100% com permissões ainda marcando "Parcial"

### Causa Raiz

A função `validate-m365-connection` tem um bloco **hardcoded** `ADDITIONAL_PERMISSIONS` (linhas 702-716) com 12 permissões que já são testadas pelo loop dinâmico que lê do banco de dados. Isso cria **entradas duplicadas** em `permissionResults` — por exemplo, `DeviceManagementManagedDevices.Read.All` aparece duas vezes: uma do DB (com tolerância completa) e outra do hardcode (com tolerância ligeiramente diferente).

A verificação final `permissionResults.every(p => p.granted)` falha se **qualquer** entrada duplicada falhar, mesmo que a outra cópia tenha passado. Resultado: status "partial" mesmo com 30/30 na UI (que mostra dados de `m365_tenant_permissions`, não de `permissionResults`).

### Solução

Remover o bloco `ADDITIONAL_PERMISSIONS` hardcoded (linhas 702-793) inteiramente. Essas permissões já são testadas pelo loop dinâmico do banco de dados com a mesma lógica de tolerância (ou melhor).

### Arquivo

- `supabase/functions/validate-m365-connection/index.ts` — remover linhas 702-793 (bloco `ADDITIONAL_PERMISSIONS` + seu loop de teste)

