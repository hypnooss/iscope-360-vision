

# HUB de Licenciamento

## Visao Geral

Nova pagina "HUB de Licenciamento" no menu lateral, acima de "Ambiente", consolidando informacoes de licenciamento de tres fontes, segregadas por workspace.

## Fontes de Dados

| Aba | Fonte | Dados |
|---|---|---|
| **Firewalls** | `analysis_history.report_data` categoria "Licenciamento" | FortiCare, FortiGuard (AV, IPS, WebFilter, AppControl), datas de expiracao |
| **Certificados TLS** | `attack_surface_snapshots.results` | Certificados TLS encontrados pelo Surface Analyzer por IP/porta — subject, issuer, dias restantes |
| **Microsoft 365** | Nova Edge Function `m365-tenant-licenses` via Graph API `/subscribedSkus` | Licencas do tenant (E3, E5, Business Premium, etc.), quantidade de licencas totais/usadas, datas de vencimento |

## Secao Tecnica

### 1. Nova Edge Function: `supabase/functions/m365-tenant-licenses/index.ts`

Busca licencas do tenant via Graph API:
- Endpoint: `GET https://graph.microsoft.com/v1.0/subscribedSkus`
- Retorna: `skuPartNumber`, `prepaidUnits.enabled`, `consumedUnits`, `capabilityStatus`, datas de validade
- Autentica usando credenciais do `m365_app_credentials` (mesmo fluxo do posture)
- Recebe `tenant_record_id` como parametro
- Retorna JSON normalizado com array de licencas

### 2. Nova tabela: `m365_tenant_licenses`

Armazena cache das licencas coletadas para exibicao sem necessidade de chamada ao Graph em tempo real:

```text
id               uuid  PK
tenant_record_id uuid  FK -> m365_tenants.id
client_id        uuid
sku_id           text
sku_part_number  text  (ex: "ENTERPRISEPACK", "SPE_E5")
display_name     text  (ex: "Office 365 E3", "Microsoft 365 E5")
capability_status text (ex: "Enabled", "Suspended", "Deleted")
total_units      integer
consumed_units   integer
warning_units    integer
suspended_units  integer
expires_at       timestamptz  (nullable - nem todas tem data de expiracao)
collected_at     timestamptz
created_at       timestamptz  DEFAULT now()
```

RLS: mesmas politicas dos outros dados M365 (acesso por client via `has_client_access`).

### 3. Nova pagina: `src/pages/LicensingHubPage.tsx`

Layout:
```text
+-------------------------------------------------------+
| HUB de Licenciamento          [Seletor Workspace]     |
+-------------------------------------------------------+
| [Expirados: 3]  [Expirando: 5]  [Ativos: 42]         |
+-------------------------------------------------------+
| [Firewalls] [Certificados TLS] [Microsoft 365]        |
+-------------------------------------------------------+
| Tabela com dados da aba selecionada                   |
+-------------------------------------------------------+
```

- **Aba Firewalls**: Tabela com nome do firewall, workspace, FortiCare (status/data), FortiGuard services (AV, IPS, WebFilter, AppControl) com datas e badges coloridos
- **Aba Certificados TLS**: Tabela com dominio/IP, subject_cn, issuer, data expiracao, dias restantes, status (expirado/expirando/ok)
- **Aba Microsoft 365**: Tabela com tenant, nome da licenca, status, licencas totais/usadas, data de vencimento, dias restantes

Badges: Vermelho (expirado), Amarelo (expirando em 30 dias), Verde (ativo)

### 4. Novo hook: `src/hooks/useLicensingHub.ts`

- Busca ultimo `analysis_history` de cada firewall do workspace, extrai checks da categoria "Licenciamento"
- Busca ultimo `attack_surface_snapshots` (completed) de cada client, extrai certificados TLS dos results
- Busca `m365_tenant_licenses` dos tenants do workspace
- Retorna dados normalizados para cada aba

### 5. Alteracoes em arquivos existentes

| Arquivo | Alteracao |
|---|---|
| `src/App.tsx` | Adicionar rota `/licensing-hub` com lazy import |
| `src/components/layout/AppLayout.tsx` | Adicionar item "HUB de Licenciamento" com icone `Key` acima de "Ambiente" (antes da linha 662), visivel para `canAccessUsers`. Adicionar `/licensing-hub` no controle de estado do sidebar (linha 215) |

### 6. Coleta das licencas M365

A Edge Function `m365-tenant-licenses` sera chamada:
- Manualmente via botao "Atualizar" na aba M365
- Pode ser integrada futuramente ao fluxo de posture analysis

A permissao necessaria no Graph API eh `Organization.Read.All` (ja listada como required no `get-m365-config`).

## Arquivos a criar

1. `supabase/functions/m365-tenant-licenses/index.ts`
2. `src/pages/LicensingHubPage.tsx`
3. `src/hooks/useLicensingHub.ts`
4. Migracao SQL para tabela `m365_tenant_licenses`

## Arquivos a alterar

1. `src/App.tsx`
2. `src/components/layout/AppLayout.tsx`
