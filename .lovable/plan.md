
# Implementação: Upload Automático de Certificados via Graph API

## Resumo

Vou implementar a automação completa do upload de certificados dos agents para o Azure App Registration. Isso elimina a necessidade de upload manual pelo usuário, tornando a configuração de agents para M365 PowerShell completamente transparente.

---

## Arquivos a Criar/Modificar

### 1. Migração de Banco de Dados
**Criar:** `supabase/migrations/[timestamp]_add_azure_certificate_config.sql`

- Adicionar `app_object_id` e `home_tenant_id` à tabela `m365_global_config`
- Adicionar `azure_certificate_key_id` à tabela `agents` para rastrear a chave registrada no Azure

### 2. Atualizar Edge Functions

**Modificar:** `supabase/functions/register-agent/index.ts`
- Após salvar o agent, chamar a lógica de upload do certificado no Azure
- Usar Graph API para adicionar o certificado ao App Registration
- Tratar erros sem falhar o registro do agent

**Modificar:** `supabase/functions/get-m365-config/index.ts`
- Retornar os novos campos `app_object_id` e `home_tenant_id`

**Modificar:** `supabase/functions/update-m365-config/index.ts`
- Aceitar e salvar os novos campos `app_object_id` e `home_tenant_id`

### 3. Atualizar Interface de Configuração

**Modificar:** `src/pages/admin/SettingsPage.tsx`
- Adicionar campos para **App Object ID** e **Home Tenant ID**
- Adicionar instruções para o administrador encontrar esses IDs no Azure Portal
- Adicionar indicador de permissão `Application.ReadWrite.OwnedBy`

### 4. Atualizar Tipos TypeScript

**Modificar:** `src/integrations/supabase/types.ts`
- Atualizar tipos para incluir os novos campos

---

## Fluxo Técnico do Upload Automático

```text
Agent Registration
       │
       ▼
┌──────────────────────────┐
│  register-agent          │
│  Salva certificado local │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│  Verifica se m365_global_config tem:                     │
│  - app_object_id                                         │
│  - home_tenant_id                                        │
│  - client_secret_encrypted                               │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼ (se configurado)
┌──────────────────────────────────────────────────────────┐
│  1. Obter access_token para Graph API                    │
│     POST https://login.microsoftonline.com/{home}/token  │
│     scope: https://graph.microsoft.com/.default          │
│                                                          │
│  2. GET /applications/{object_id}?$select=keyCredentials │
│     (buscar certificados existentes)                     │
│                                                          │
│  3. PATCH /applications/{object_id}                      │
│     keyCredentials: [...existing, newCert]               │
│                                                          │
│  4. Atualizar agents.azure_certificate_key_id            │
└──────────────────────────────────────────────────────────┘
           │
           ▼
    Agent registrado com certificado no Azure
```

---

## Campos de Interface (Admin Settings)

Na aba **Microsoft 365**, adicionar seção "Configuração Avançada para Agents":

| Campo | Descrição |
|-------|-----------|
| App Object ID | Object ID do App Registration (não confundir com App ID) |
| Home Tenant ID | Tenant ID onde o App foi criado |

Com instruções:
1. Azure Portal → App Registrations → iScope 360
2. Copiar **Object ID** (diferente do Application ID)
3. Copiar **Directory (tenant) ID**
4. Adicionar permissão `Application.ReadWrite.OwnedBy` e conceder Admin Consent

---

## Tratamento de Erros

| Cenário | Comportamento |
|---------|---------------|
| Config M365 incompleta | Agent registra normalmente, log de warning |
| Permissão faltando | Agent registra, log de erro, certificado não sobe |
| Erro de rede | Agent registra, retry pode ser manual |
| Certificado duplicado | Ignora, continua |

O registro do agent **nunca** falha por causa do upload de certificado.

---

## Seção Técnica

### Graph API Call

```http
PATCH https://graph.microsoft.com/v1.0/applications/{object-id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "keyCredentials": [
    // ... certificados existentes (buscar primeiro com GET) ...
    {
      "type": "AsymmetricX509Cert",
      "usage": "Verify",
      "key": "MIIDYDCCAkigAwIBAgIQ...", // Base64 do certificado
      "displayName": "iScope-Agent-NomeDoAgent-abc12345",
      "startDateTime": "2026-02-06T00:00:00Z",
      "endDateTime": "2028-02-06T00:00:00Z"
    }
  ]
}
```

### Permissão Necessária no Azure

| Permissão | Tipo |
|-----------|------|
| `Application.ReadWrite.OwnedBy` | Application |

Esta permissão permite que o app modifique a si mesmo (adicionar certificados).

### Decriptografia do Client Secret

A função já usa AES-256-GCM para decriptar o `client_secret_encrypted`. O mesmo será usado para autenticar no Graph API.
