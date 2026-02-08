
# Plano: Blueprint M365 PowerShell (Exchange + SharePoint)

## Contexto

Criar um blueprint do tipo `agent` que utilize o executor PowerShell para coletar dados do Exchange Online e SharePoint Online via CBA (Certificate-Based Authentication).

## Arquitetura

| Campo | Valor |
|-------|-------|
| **Nome** | M365 - Exchange & SharePoint (Agent) |
| **Tipo de Executor** | `agent` |
| **Template** | Microsoft 365 (m365) |
| **Device Type ID** | `5d1a7095-2d7b-4541-873d-4b03c3d6122f` |

## Steps de Coleta - Exchange Online

### 1. Configurações de Mailbox
| Step ID | Comando PowerShell | Descrição |
|---------|-------------------|-----------|
| `exo_mailbox_forwarding` | `Get-Mailbox -ResultSize Unlimited \| Select DisplayName, ForwardingAddress, ForwardingSmtpAddress, DeliverToMailboxAndForward` | Encaminhamentos de e-mail |
| `exo_inbox_rules` | `Get-InboxRule -Mailbox * -IncludeHidden` | Regras de inbox (redirecionamentos) |
| `exo_cas_mailbox` | `Get-CASMailbox -ResultSize Unlimited \| Select Identity, ImapEnabled, PopEnabled, ActiveSyncEnabled, OWAEnabled, EwsEnabled` | Protocolos habilitados por mailbox |

### 2. Políticas de Transporte
| Step ID | Comando PowerShell | Descrição |
|---------|-------------------|-----------|
| `exo_transport_rules` | `Get-TransportRule \| Select Name, State, Priority, FromScope, SentTo, RedirectMessageTo, BlindCopyTo` | Regras de fluxo de e-mail |
| `exo_connectors_inbound` | `Get-InboundConnector` | Conectores de entrada |
| `exo_connectors_outbound` | `Get-OutboundConnector` | Conectores de saída |
| `exo_remote_domains` | `Get-RemoteDomain \| Select DomainName, AllowedOOFType, AutoForwardEnabled, DeliveryReportEnabled` | Domínios remotos e auto-forward |

### 3. Políticas Anti-Spam/Anti-Malware
| Step ID | Comando PowerShell | Descrição |
|---------|-------------------|-----------|
| `exo_antispam_policy` | `Get-HostedContentFilterPolicy` | Políticas anti-spam |
| `exo_antimalware_policy` | `Get-MalwareFilterPolicy` | Políticas anti-malware |
| `exo_safe_attachments` | `Get-SafeAttachmentPolicy` | Políticas de anexos seguros (Defender) |
| `exo_safe_links` | `Get-SafeLinksPolicy` | Políticas de links seguros (Defender) |

### 4. Auditoria e Compliance
| Step ID | Comando PowerShell | Descrição |
|---------|-------------------|-----------|
| `exo_audit_config` | `Get-AdminAuditLogConfig` | Configuração de log de auditoria |
| `exo_retention_policies` | `Get-RetentionPolicy` | Políticas de retenção |
| `exo_dlp_policies` | `Get-DlpPolicy` | Políticas de DLP |
| `exo_journal_rules` | `Get-JournalRule` | Regras de journaling |

## Steps de Coleta - SharePoint Online

### 5. Sites e Configurações
| Step ID | Comando PowerShell | Módulo | Descrição |
|---------|-------------------|--------|-----------|
| `spo_tenant_settings` | `Get-SPOTenant` | SharePointOnlinePowerShell | Configurações globais do tenant |
| `spo_sites` | `Get-SPOSite -Limit All \| Select Url, Title, SharingCapability, ConditionalAccessPolicy, LockState` | SharePointOnlinePowerShell | Inventário de sites |
| `spo_external_users` | `Get-SPOExternalUser -SiteUrl <cada site>` | SharePointOnlinePowerShell | Usuários externos por site |

### 6. Segurança e Compartilhamento
| Step ID | Comando PowerShell | Descrição |
|---------|-------------------|-----------|
| `spo_sharing_capability` | `Get-SPOTenant \| Select SharingCapability, DefaultSharingLinkType, DefaultLinkPermission` | Configurações de compartilhamento |
| `spo_access_control` | `Get-SPOTenant \| Select ConditionalAccessPolicy, LegacyAuthProtocolsEnabled, DisableCustomAppAuthentication` | Controles de acesso |

## Estrutura JSON do Blueprint

```json
{
  "steps": [
    {
      "id": "exo_mailbox_forwarding",
      "type": "powershell",
      "category": "Exchange - Mailbox",
      "params": {
        "module": "ExchangeOnline",
        "commands": ["Get-Mailbox -ResultSize Unlimited | Select DisplayName, ForwardingAddress, ForwardingSmtpAddress, DeliverToMailboxAndForward | ConvertTo-Json -Depth 5"]
      }
    },
    // ... outros steps
  ]
}
```

## Considerações

1. **Autenticação**: Os steps usarão CBA com o certificado do agente
2. **Módulos**: ExchangeOnlineManagement para Exchange, Microsoft.Online.SharePoint.PowerShell para SharePoint
3. **Timeout**: Steps com -ResultSize Unlimited podem demorar em tenants grandes
4. **Rate Limiting**: Adicionar throttling entre comandos se necessário

## Próximos Passos

1. Inserir o blueprint no banco de dados
2. Criar as regras de compliance correspondentes
3. Testar a execução via agente
