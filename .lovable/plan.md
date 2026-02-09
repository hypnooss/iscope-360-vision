

# Enriquecer Blueprint M365 - Exchange Online

## Analise de Duplicacao: API vs Agent

Todos os 10 steps PowerShell atuais utilizam cmdlets do Exchange Online Management que **nao possuem equivalente na Graph API**. A Microsoft nao expoe as configuracoes de protecao do Exchange (Anti-Phish, Safe Links, Safe Attachments, Transport Rules, DKIM, etc.) via REST API. Portanto, **nao ha duplicacao** e o uso do Agent e obrigatorio para estes dados.

O unico step Graph API existente (`sample_users_for_mailbox`) e complementar — fornece IDs de usuarios para correlacao.

## Novos Steps Propostos (somente Agent/PowerShell)

Todos os enrichments abaixo sao exclusivos de PowerShell, sem equivalente na Graph API:

### Prioridade Alta (Seguranca)

| Step ID | Cmdlet | Finalidade |
|---------|--------|------------|
| `exo_audit_config` | `Get-AdminAuditLogConfig` | Verificar se auditoria admin esta habilitada |
| `exo_org_config` | `Get-OrganizationConfig` | OAuth habilitado, SMTP Auth, Focused Inbox |
| `exo_accepted_domains` | `Get-AcceptedDomain` | Dominios aceitos e tipo (autoritativo vs relay) |
| `exo_inbound_connectors` | `Get-InboundConnector` | Conectores de entrada (bypass de SPF/filtros) |
| `exo_outbound_connectors` | `Get-OutboundConnector` | Conectores de saida (roteamento TLS) |

### Prioridade Media (Governanca)

| Step ID | Cmdlet | Finalidade |
|---------|--------|------------|
| `exo_role_assignments` | `Get-ManagementRoleAssignment -GetEffectiveUsers -RoleGroup "Organization Management"` | Quem tem permissoes administrativas no Exchange |
| `exo_mailbox_audit` | `Get-Mailbox -ResultSize 100 \| Select AuditEnabled, AuditOwner` | Status de auditoria por mailbox |
| `exo_auth_policy` | `Get-AuthenticationPolicy` | Politicas de autenticacao (bloqueio de protocolos legados) |

### Prioridade Baixa (Informacional)

| Step ID | Cmdlet | Finalidade |
|---------|--------|------------|
| `exo_mobile_device_policy` | `Get-MobileDeviceMailboxPolicy` | Politicas de dispositivos moveis (PIN, wipe) |
| `exo_shared_mailboxes` | `Get-Mailbox -RecipientTypeDetails SharedMailbox -ResultSize 200 \| Select DisplayName, PrimarySmtpAddress, MessageCopyForSentAsEnabled` | Caixas compartilhadas e config |

## Compliance Rules a Criar (EXO-006 a EXO-020)

Regras para avaliar os dados ja coletados + novos steps:

### Para steps existentes

| Codigo | Nome | Step Source | Severidade |
|--------|------|------------|------------|
| EXO-006 | Politica Anti-Phishing Desabilitada | `exo_anti_phish_policy` | critical |
| EXO-007 | Safe Links Desabilitado | `exo_safe_links_policy` | high |
| EXO-008 | Safe Attachments Desabilitado | `exo_safe_attachment_policy` | high |
| EXO-009 | DKIM Nao Configurado | `exo_dkim_config` | high |
| EXO-010 | Filtro de Malware Sem File Filter | `exo_malware_filter_policy` | medium |
| EXO-011 | Auto-Forward Habilitado em Remote Domains | `exo_remote_domains` | high |
| EXO-012 | Transport Rules Redirecionando para Externo | `exo_transport_rules` | critical |
| EXO-013 | Spam Filter Permissivo | `exo_hosted_content_filter` | medium |
| EXO-014 | OWA Permite Download Direto em PCs Publicos | `exo_owa_mailbox_policy` | medium |

### Para novos steps

| Codigo | Nome | Step Source | Severidade |
|--------|------|------------|------------|
| EXO-015 | Auditoria Admin Desabilitada | `exo_audit_config` | critical |
| EXO-016 | SMTP Auth Global Habilitado | `exo_org_config` | high |
| EXO-017 | Dominio Aceito como Relay | `exo_accepted_domains` | high |
| EXO-018 | Conector Inbound Bypass SPF | `exo_inbound_connectors` | critical |
| EXO-019 | Conector Outbound sem TLS | `exo_outbound_connectors` | high |
| EXO-020 | Auditoria de Mailbox Desabilitada | `exo_mailbox_audit` | medium |

## Reativacao das Regras Legadas (EXO-001 a EXO-005)

As regras EXO-001 a EXO-005 estao desativadas. A EXO-001 (Redirecionamento Externo) deve ser **reativada** com `evaluation_logic` apontando para o step `exo_mailbox_forwarding` do Agent (nao mais via Graph API individual). As demais (EXO-002 a EXO-005) sao informacionais e podem ser mantidas inativas por enquanto.

## Secao Tecnica

### Implementacao dos novos steps no blueprint

Cada novo step sera adicionado ao array `collection_steps.steps` do blueprint "M365 - Exchange Online" via `UPDATE` SQL. Formato padrao:

```text
{
  "id": "exo_audit_config",
  "type": "powershell",
  "category": "Exchange - Audit",
  "params": {
    "module": "ExchangeOnline",
    "timeout": 30,
    "commands": [{
      "name": "exo_audit_config",
      "command": "Get-AdminAuditLogConfig | Select-Object UnifiedAuditLogIngestionEnabled, AdminAuditLogEnabled, AdminAuditLogAgeLimit"
    }]
  }
}
```

### Implementacao das compliance rules

Cada regra sera `INSERT` na tabela `compliance_rules` com:
- `device_type_id`: ID do device_type m365
- `category`: `email_exchange`
- `evaluation_logic`: JSON especifico para cada regra
- `is_active`: true
- Campos descritivos: `recommendation`, `pass_description`, `fail_description`, `technical_risk`, `business_impact`

### Nenhuma mudanca na edge function

A `m365-security-posture` ja carrega todas as compliance rules ativas e avalia contra os dados coletados. Os novos steps serao executados pelo Agent automaticamente (ja que o blueprint e `hybrid` e o `rpc_get_agent_tasks` filtra por `executor_type = 'agent'`).

### Nenhuma mudanca no Agent Python

O agente ja processa steps do tipo `powershell` com modulo `ExchangeOnline` dinamicamente.

## Arquivos Modificados

| Item | Mudanca |
|------|---------|
| Banco de dados (`device_blueprints`) | Adicionar 8 novos steps PowerShell ao blueprint Exchange Online |
| Banco de dados (`compliance_rules`) | Inserir 15 novas regras (EXO-006 a EXO-020) + reativar EXO-001 |

## Riscos

- **Timeout**: Steps como `exo_role_assignments` podem ser lentos em tenants grandes. Mitigacao: usar `-ResultSize` e timeout de 60s.
- **Licenciamento**: `Get-SafeLinksPolicy` e `Get-SafeAttachmentPolicy` requerem Defender for Office 365. O agent ja trata com `-ErrorAction SilentlyContinue`.

