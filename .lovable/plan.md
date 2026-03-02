

## Diagnóstico: SPO-002 e SPO-004 ainda "não disponíveis"

### Causa Raiz

Ambas as regras dependem do step `sharepoint_external_sharing` que chama `/admin/sharepoint/settings` (beta). Este endpoint retorna **403: "Caller does not have required permissions"**.

O motivo: o GUID registrado para `SharePointTenantSettings.Read.All` no código é **`83d4163d-a2d8-4e3b-b3a5-5d4b1a5e5f6e`** — um valor fabricado/incorreto. O Azure nunca registrou essa permissão no manifesto porque o GUID não existe. Por isso, mesmo após revalidar permissões, ela nunca aparece no token.

### Solução: Eliminar dependência do `/admin/sharepoint/settings`

Em vez de corrigir o GUID (que exigiria permissão SharePoint Admin de alto privilégio), a melhor abordagem é **reescrever as regras SPO-002 e SPO-004 para usar endpoints que já funcionam** com `Sites.Read.All` (que já está no token). É exatamente o que o `m365-check-sharepoint` já faz com sucesso.

### Alterações

**1. Blueprint do SharePoint (migration SQL):**
- Remover o step `sharepoint_external_sharing` 
- Adicionar dois novos steps:
  - `sharepoint_drive_permissions` → `/sites/root` + iteração em drives para verificar links anônimos
  - `sharepoint_onedrive_permissions` → `/users?$top=20` + iteração em drives de usuários

**2. `m365-security-posture/index.ts`:**
- Reescrever `check_sharepoint_anonymous_links` para fazer a coleta inline (como faz o `m365-check-sharepoint`) usando chamadas Graph API diretas com o token disponível
- Reescrever `check_onedrive_sharing` da mesma forma
- Atualizar as regras SPO-002 e SPO-004 no DB para usar `source_key: "sharepoint_sites"` (que já funciona) como trigger, com a lógica real fazendo chamadas adicionais

**3. Alternativa mais limpa — Coleta inline no evaluator:**
- Como SPO-002 e SPO-004 requerem múltiplas chamadas encadeadas (root site → drives → permissions), o modelo de "1 step = 1 endpoint" não funciona bem
- Solução: criar um tipo de avaliação especial (`check_sharepoint_anonymous_links_live` e `check_onedrive_sharing_live`) que recebe o `accessToken` e faz as chamadas diretamente no evaluator, usando a lógica já provada do `m365-check-sharepoint`

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/m365-security-posture/index.ts` | Adicionar lógica de coleta inline para SPO-002 e SPO-004 usando `Sites.Read.All`; passar `accessToken` ao evaluator para esses casos especiais |
| Migration SQL | Atualizar `evaluation_logic` de SPO-002 e SPO-004 para usar o novo tipo de avaliação com `source_key: "sharepoint_sites"` |
| `supabase/functions/ensure-exchange-permission/index.ts` | Corrigir ou remover o GUID falso de `SharePointTenantSettings.Read.All`; remover o step `sharepoint_external_sharing` do blueprint |

