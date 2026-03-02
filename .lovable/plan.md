

## Pente Fino — M365 Compliance Blueprint: Auditoria Completa

### ✅ Implementado

**Fase 1 — Correções imediatas:**
- ✅ Step `sharepoint_external_sharing` removido do blueprint SharePoint
- ✅ Step `teams_settings` marcado como `optional: true` no blueprint Teams
- ✅ Regra AUT-006 (Bloqueio de Autenticação Legada) adicionada ao banco
- ✅ Regra EXO-022 (Inbox Rules Suspeitas) criada com evaluator `check_suspicious_inbox_rules`
- ✅ GUIDs corrigidos: `SecurityAlert.Read.All` (472e4a4d→correto) e `SecurityIncident.Read.All` (45cc0394→correto)
- ✅ Regras EXO-002~005 (placeholders inativos) removidas

**Fase 2 — Novas regras (9 regras adicionadas):**
- ✅ AUT-008: Política de Expiração de Senha (`check_password_expiration`)
- ✅ AUT-009: Self-Service Password Reset (`check_sspr_enabled`)
- ✅ AUT-010: CA com Sign-In Risk (`check_ca_signin_risk`)
- ✅ AUT-011: CA com User Risk (`check_ca_user_risk`)
- ✅ ADM-007: Contas de Emergência Break Glass (`check_break_glass_accounts`)
- ✅ APP-008: Credenciais de Longa Duração (`count_long_lived_credentials`)
- ✅ IDT-007: Usuários Sem Licença (`count_unlicensed_users`)
- ✅ Step `authorization_policy` adicionado ao blueprint Entra ID

**Fase 3 — Qualidade e robustez:**
- ✅ Paginação `@odata.nextLink` implementada no `executeGraphApiStep` (até 5 páginas)
- ✅ `check_teams_private_channels` real (itera teams e conta canais privados via Graph API)

### Pendente (requer Agent PowerShell)
- EXO-021: Shared Mailbox com Login Direto (precisa de step no blueprint de Agent)

### Pendente (UX - Fase futura)
- Banner de categoria não licenciada (Intune/MIP) na UI
- Severidade original mantida em items "pass" (requer mudança no `createInsight`)
