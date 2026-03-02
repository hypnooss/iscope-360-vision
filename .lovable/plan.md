

## Pente Fino — M365 Compliance: Auditoria Completa

### Status Atual: 60 regras, apenas ~30 funcionando

De 60 regras no relatório, **~30 retornam `not_found`**. Analisando a última análise do tenant BRASILUX, identifiquei **4 categorias de problemas**:

---

### A. Bugs nos Endpoints do Blueprint (corrigíveis imediatamente)

| Step | Erro | Causa | Correção |
|---|---|---|---|
| `teams_list` | 400: "Only one property can be expanded" | `$expand=owners,members` — Graph v1.0 não aceita dois expands | Remover `members` do expand, coletar separadamente ou usar apenas `owners` |
| `sharepoint_sites` | 400: "Could not find property 'sharingCapability'" | `sharingCapability` não existe em `microsoft.graph.site` | Remover esse campo do `$select` |
| `pim_role_assignments` / `pim_role_active_assignments` | 400: CultureNotFoundException | Bug no Graph que requer header `Accept-Language` | Adicionar `Accept-Language: en-US` no config do step |
| `teams_settings` | 412: "Not supported in application-only context" | `/teamwork/teamsAppSettings` requer contexto delegado | Mover para coleta via Agent PowerShell ou marcar como limitação conhecida |

**Impacto:** Corrigir esses 4 bugs desbloquearia **TMS-001 a TMS-004** (4 regras), **SPO-001 a SPO-004** (4 regras) e **PIM-001 a PIM-004** (4 regras) = **12 regras**.

---

### B. Permissões Não Consentidas (requer nova análise)

| Step | Erro | Permissão Faltante |
|---|---|---|
| `security_alerts_v2` | 403: Missing application roles | `SecurityAlert.Read.All` |
| `security_incidents` | 403: Missing application roles | `SecurityIncident.Read.All` |

As permissões estão marcadas como `granted` na tabela de permissões (bug do validate que corrigimos), mas o **token da análise de postura** ainda não as possui. O token é obtido no momento da análise, e se o Azure AD ainda não propagou o consent, falha.

**Correção:** O `m365-security-posture` precisa usar o mesmo mecanismo de retry que implementamos no `validate-m365-connection` — ou simplesmente **rodar uma nova análise agora** que o consent deve ter propagado.

**Impacto:** **DEF-001** e **DEF-002** (2 regras).

---

### C. Limitações Legítimas de Licenciamento (N/A correto)

| Categoria | Erro | Motivo |
|---|---|---|
| INT-001 a INT-006 (Intune) | 400: "Request not applicable to target tenant" | Tenant BRASILUX **não tem licença Intune** |
| DEF-005 (Labels MIP) | 400: MIP service disabled | Tenant **não tem Microsoft Information Protection** |

Esses itens aparecem corretamente como N/A. **Porém**, a experiência do usuário é ruim — o relatório mostra 6 itens de Intune "cinza" que poluem a visualização.

**Sugestão:** Detectar no início da análise se o tenant tem Intune/MIP e **ocultar automaticamente** as categorias inteiras que não se aplicam, ou mostrar um banner "Categoria não disponível — requer licença X" em vez de N/A em cada item individual.

---

### D. Bugs de Interpolação nas Descrições

Vários insights mostram `{count}`, `{{confirmed}}`, `{{atRisk}}` não resolvidos:
- AUT-004: `"{27} usuário(s) de risco: {{confirmed}} confirmado(s), {{atRisk}} em risco"`
- IDT-001: `"{346} usuário(s) sem MFA"`

O interpolador usa `{count}` mas os templates usam `{{confirmed}}` — sintaxe inconsistente.

---

### E. Oportunidades de Enriquecimento

Dados disponíveis via Graph API/PowerShell que **não estão** no relatório atual:

| Nova Regra | Endpoint | Categoria | Valor |
|---|---|---|---|
| Política de Expiração de Senha | `/domains` (passwordValidityPeriodInDays) | auth_access | Crítico — verifica se senhas expiram |
| Self-Service Password Reset | `/policies/authorizationPolicy` | auth_access | Se SSPR está habilitado |
| Contas de Acesso de Emergência | `/directoryRoles` (Global Admin sem MFA forced) | admin_privileges | Best practice Microsoft |
| Sign-In Risk Policy | `/identity/conditionalAccess/policies` (filtrar por signInRiskLevels) | auth_access | Verifica se há CA baseada em risco |
| User Risk Policy | `/identity/conditionalAccess/policies` (filtrar por userRiskLevels) | auth_access | Idem |
| Mailbox com Delegação | PowerShell: `Get-EXOMailboxPermission` | email_exchange | Detecta acessos delegados suspeitos |
| DMARC/SPF dos Domínios | DNS lookup nos domínios do tenant | email_exchange | Proteção contra spoofing |
| Shared Mailbox com Login Direto | PowerShell: `Get-EXOMailbox -RecipientTypeDetails SharedMailbox` | email_exchange | Shared mailboxes não devem ter senha |
| Regras de Inbox Suspeitas | PowerShell: `Get-InboxRule` com forward/redirect | email_exchange | Exfiltração de dados |
| External Forwarding Global Policy | Exchange: `Get-TransportConfig` (SmtpClientAuthenticationDisabled) | email_exchange | Já existe parcialmente |

---

### Plano de Implementação (priorizado)

**Fase 1 — Corrigir o que está quebrado (blueprint bugs):**

| Arquivo | Alteração |
|---|---|
| Blueprint `M365 - SharePoint & OneDrive` (DB) | Remover `sharingCapability` do $select no step `sharepoint_sites` |
| Blueprint `M365 - Teams` (DB) | Dividir `teams_list` em dois steps: um com `$expand=owners`, outro com `$expand=members` |
| Blueprint `M365 - PIM & Governance` (DB) | Adicionar `Accept-Language: en-US` nos headers dos steps PIM |
| `m365-security-posture/index.ts` | Corrigir interpolação: substituir `{{var}}` por `{var}` nos templates ou atualizar o interpolador |

**Fase 2 — Melhorar UX para itens N/A:**

| Arquivo | Alteração |
|---|---|
| `m365-security-posture/index.ts` | Detectar ausência de Intune/MIP no início e marcar categoria inteira como "não licenciada" em vez de N/A por item |
| UI (M365PosturePage / ComplianceCard) | Exibir banner informativo por categoria não licenciada |

**Fase 3 — Enriquecimento com novas regras:**

Adicionar as regras da tabela E acima ao `compliance_rules` e os steps correspondentes aos blueprints.

---

### Recomendação Imediata

Começar pela **Fase 1** — corrigir os 4 bugs de blueprint que desbloqueiam 12+ regras. Isso transformaria o relatório de "60% quebrado" para "~85% funcional", deixando apenas as limitações legítimas de licenciamento.

