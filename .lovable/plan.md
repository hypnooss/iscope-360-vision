

## Pente Fino — M365 Compliance Blueprint: Auditoria Completa

### Estado Atual

**48 regras ativas**, distribuídas em 11 categorias. Última análise: **score 18/100**, 16 falhas, 9 not_found, 23 pass.

| Categoria | Regras | Status |
|---|---|---|
| Identidades (IDT) | 6 | Todas funcionando |
| Autenticação (AUT) | 6 | 5 funcionando, AUT-006 ausente |
| Admin (ADM) | 6 | Todas funcionando |
| Apps (APP) | 7 | Todas funcionando |
| Exchange (EXO) | 8 ativas + 4 inativas | Todas via Agent PowerShell — funcionando |
| Defender (DEF) | 5 | DEF-001/002 = 403 (permissão), DEF-005 = sem licença |
| Intune (INT) | 6 | Sem licença — N/A correto |
| PIM | 4 | Todas funcionando |
| SharePoint (SPO) | 4 | Todas funcionando |
| Teams (TMS) | 4 | Todas funcionando |

---

### A. Bugs e Inconsistências a Corrigir

**1. DEF-001/DEF-002 ainda com 403** — `SecurityAlert.Read.All` e `SecurityIncident.Read.All` estão na lista de permissões do `ensure-exchange-permission`, mas a análise de postura ainda recebe 403. Provável causa: o consent não foi re-executado após adicionar essas permissões, ou o token ainda não reflete. Solução: verificar se os GUIDs estão corretos (atualmente `SecurityAlert.Read.All` = `ed4fca05-be46-441f-9571-c4c67ef95418`, `SecurityIncident.Read.All` = `45cc0394-e837-488b-a098-1918f48d186c`). Se estiverem fabricados, corrigir como fizemos com `SharePointTenantSettings`.

**2. SPO-002 e SPO-004 têm `source_key: sharepoint_external_sharing`** mas a avaliação inline ignora isso e usa `accessToken` diretamente. Porém, o step `sharepoint_external_sharing` no blueprint ainda está ativo e retorna 403, gerando um erro inútil nos logs. Deve ser removido do blueprint.

**3. EXO regras inativas (EXO-002, 003, 004, 005)** — 4 regras desativadas sem `evaluation_logic` preenchida. São placeholders abandonados que nunca foram implementados.

**4. TMS-004 (Canais Privados)** — O evaluator `check_teams_private_channels` hardcoda `count: 0` em vez de fazer a contagem real. Precisaria de chamadas adicionais (`/teams/{id}/channels?$filter=membershipType eq 'private'`).

**5. AUT-006 (Legacy Auth Block)** — A regra existe no evaluator (`check_legacy_auth_block`) mas não aparece na query de regras ativas. Pode estar faltando no banco.

---

### B. Oportunidades de Enriquecimento — Novas Regras

Usando permissões **já disponíveis** (29 Graph + 2 RBAC):

| Código | Nome | Endpoint / Source | Categoria | Severidade | Permissão Já Disponível |
|---|---|---|---|---|---|
| AUT-008 | Política de Expiração de Senha | `/domains` (passwordValidityPeriodInDays) | auth_access | high | `Domain.Read.All` ✓ |
| AUT-009 | Self-Service Password Reset | `/policies/authorizationPolicy` | auth_access | medium | `Policy.Read.All` ✓ |
| AUT-010 | CA com Sign-In Risk | `/identity/conditionalAccess/policies` (filtrar signInRiskLevels) | auth_access | high | `Policy.Read.All` ✓ |
| AUT-011 | CA com User Risk | `/identity/conditionalAccess/policies` (filtrar userRiskLevels) | auth_access | high | `Policy.Read.All` ✓ |
| ADM-007 | Contas de Emergência (Break Glass) | `/directoryRoles` → Global Admin sem MFA | admin_privileges | critical | `Directory.Read.All` ✓ |
| IDT-007 | Usuários Sem Licença Atribuída | `/users?$select=assignedLicenses` | identities | low | `User.Read.All` ✓ |
| APP-008 | Apps com Credenciais de Longa Duração | `/applications` (keyCredentials > 2 anos) | apps_integrations | medium | `Application.Read.All` ✓ |
| EXO-021 | Shared Mailbox com Login Direto | Agent: `Get-EXOMailbox -RecipientTypeDetails SharedMailbox` | email_exchange | high | Exchange RBAC ✓ |
| EXO-022 | Regras de Inbox Suspeitas (Forward/Redirect) | Já coletado: `exo_inbox_rules` | email_exchange | critical | Exchange RBAC ✓ |

**Nota sobre EXO-022**: O step `exo_inbox_rules` já coleta regras de inbox com ForwardTo/RedirectTo — basta criar a regra de compliance que avalia esses dados. É o enriquecimento mais barato possível.

---

### C. Melhorias no Blueprint de Coleta

**1. Step `sharepoint_external_sharing` (SharePoint blueprint):** Remover — não funciona e não é mais necessário (SPO-002/004 usam inline).

**2. Step `teams_settings` (Teams blueprint):** Retorna 412 (app-only context). Marcar como `optional: true` ou remover, pois nenhuma regra o consome.

**3. Paginação:** Steps como `mfa_registration_details` e `users_signin_activity` usam `$top=999`. Para tenants grandes (>1000 users), os dados ficam truncados. Implementar `@odata.nextLink` pagination no `executeGraphApiStep`.

**4. Step `domains` no Entra ID blueprint:** Já coleta `passwordValidityPeriodInDays` — bastaria adicionar ao `$select` para habilitar AUT-008 sem novo step.

---

### D. Melhorias na UX (Fase 2)

**1. Categorias sem licença:** Detectar no início da análise se Intune/MIP estão disponíveis (via `/subscribedSkus`) e marcar a categoria inteira como "não licenciada" em vez de 6 itens N/A individuais.

**2. Severidade dinâmica em itens "pass":** Atualmente, todos os items que passam recebem `severity: 'info'`. Manter a severidade original para que o usuário entenda a criticidade da regra mesmo quando ela passa.

---

### Plano de Implementação (priorizado)

**Fase 1 — Correções imediatas:**

| Arquivo | Alteração |
|---|---|
| Migration SQL | Remover step `sharepoint_external_sharing` do blueprint SharePoint |
| Migration SQL | Marcar step `teams_settings` como `optional: true` |
| Migration SQL | Adicionar regra AUT-006 (Legacy Auth Block) se faltante |
| Migration SQL | Criar regra EXO-022 (Inbox Rules Suspeitas) usando `source_key: exo_inbox_rules` já coletado |
| `ensure-exchange-permission/index.ts` | Verificar GUIDs de `SecurityAlert.Read.All` e `SecurityIncident.Read.All` |

**Fase 2 — Novas regras com dados já disponíveis:**

| Arquivo | Alteração |
|---|---|
| Migration SQL | Adicionar AUT-008 (Expiração de Senha), AUT-009 (SSPR), AUT-010/011 (CA Risk Policies) |
| Migration SQL | Adicionar ADM-007 (Break Glass), APP-008 (Credenciais Longas), IDT-007 (Sem Licença) |
| Migration SQL | Adicionar step de coleta para `domains` com `$select` expandido |
| `m365-security-posture/index.ts` | Implementar evaluators para os novos tipos |

**Fase 3 — Qualidade e robustez:**

| Arquivo | Alteração |
|---|---|
| `m365-security-posture/index.ts` | Implementar paginação `@odata.nextLink` para steps com `$top` |
| `m365-security-posture/index.ts` | Implementar `check_teams_private_channels` real (chamadas por team) |
| Migration SQL | Ativar ou remover as regras EXO-002~005 inativas |
| UI | Fase 2 UX — banner de categoria não licenciada |

