# Plano: Correção da Coleta de Dados Exchange Online

## Status: ✅ Implementado

## Resumo do Problema

A página Exchange Online exibia apenas **2 insights** (ambos do Agent). Os dados via Graph API **não estavam sendo coletados** corretamente.

---

## Implementação Realizada (Opção A - Foco no Agent)

### ✅ Fase 1: Expandir processM365AgentInsights

Adicionados processadores para todos os 10 steps do Exchange coletados pelo Agent:

| Step ID | Status | Insight Gerado |
|---------|--------|----------------|
| `exo_mailbox_forwarding` | ✅ Já existia | Encaminhamento de Email |
| `exo_inbox_rules` | ✅ Já existia | Regras de Caixa de Entrada |
| `exo_transport_rules` | ✅ Já existia | Regras de Transporte |
| `exo_antispam_policy` | ✅ Já existia | Política Anti-Spam |
| `exo_dkim_config` | ✅ Já existia | Configuração DKIM |
| `exo_anti_phish_policy` | ✅ **Adicionado** | Política Anti-Phishing |
| `exo_safe_links_policy` | ✅ **Adicionado** | Safe Links |
| `exo_safe_attachment_policy` | ✅ **Adicionado** | Safe Attachments |
| `exo_malware_filter_policy` | ✅ **Adicionado** | Filtro de Malware |
| `exo_hosted_content_filter` | ✅ **Adicionado** | Filtro de Conteúdo (Spam) |
| `exo_remote_domains` | ✅ **Adicionado** | Domínios Remotos |
| `exo_owa_mailbox_policy` | ✅ **Adicionado** | Política OWA |

### ✅ Fase 2: Desativar regras EXO via API

Regras desativadas (dependem de Graph API per-user - não funcionais):
- `EXO-001` - Redirecionamento Externo de Email
- `EXO-002` - Redirecionamento Interno de Email
- `EXO-003` - Auto-Respostas Permanentes
- `EXO-004` - Mailboxes Analisadas
- `EXO-005` - Acesso a Mailboxes

---

## Arquivos Modificados

1. **Edge Function**: `supabase/functions/agent-task-result/index.ts`
   - Expandido `processM365AgentInsights()` com 7 novos processadores

2. **Banco de Dados**: Migração SQL aplicada
   - Desativadas 5 regras EXO que dependiam de API per-user

---

## Fluxo Corrigido

```
┌─────────────────────────────────────────────────────────────────┐
│ Agent (PowerShell)                                              │
│ ─────────────────────                                           │
│ 12 steps (Exchange completo)                                    │
│       ↓                                                         │
│ 12+ insights (todos processados)                                │
│       ↓                                                         │
│ Exchange Online Page                                            │
│ (exibe 12+ insights com severidade e recomendações)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Próximos Passos

1. Execute uma nova análise M365 para verificar os 12+ insights
2. Os cards devem mostrar insights por categoria: email, threats
