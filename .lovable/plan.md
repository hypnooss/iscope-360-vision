

# Correcoes do HUB de Licenciamento

## 4 problemas identificados

### 1. Espacamento da pagina

A pagina atual usa `<div className="space-y-6">` sem padding. Todos os outros modulos usam `<div className="p-6 lg:p-8 space-y-6">`.

**Arquivo:** `src/pages/LicensingHubPage.tsx`
- Alterar `className="space-y-6"` para `className="p-6 lg:p-8 space-y-6"`

---

### 2. Firewalls sem datas de vencimento

**Causa raiz:** Os dados de expiracao estao dentro de `rawData.license_status.results`, como Unix timestamps (ex: `expires: 1780099200`). A funcao `extractExpiryFromCheck` busca apenas nos campos `evidence` e `description`, ignorando completamente o `rawData`.

Exemplo real do ITJ-FW:
```text
rawData.license_status.results.forticare.support.enhanced.expires = 1780099200
rawData.license_status.results.antivirus.expires = 1780099200
rawData.license_status.results.appctrl.expires = 1780099200
```

**Correcao no `src/hooks/useLicensingHub.ts`:**

Reescrever a extracao de dados de firewall para usar o `rawData.license_status.results` diretamente em vez de depender dos campos textuais de `evidence`:

1. Extrair `forticare` de `rawData.license_status.results.forticare.support.enhanced.expires` (Unix timestamp)
2. Extrair cada servico FortiGuard (antivirus, appctrl, ips, webfilter, etc.) de `rawData.license_status.results.[service].expires`
3. Converter Unix timestamps para datas ISO (`new Date(ts * 1000).toISOString()`)
4. Manter fallback para a logica atual caso `rawData` nao exista

Os servicos a extrair do `rawData.license_status.results`:
- `forticare` -> `support.enhanced.expires`
- `antivirus` -> `expires`
- `appctrl` -> `expires`  
- `industrial_db` / `ips` -> `expires`
- `forticloud_sandbox` -> `expires`
- `botnet_domain` -> `expires`
- Qualquer servico com campo `expires` e `status: "licensed"`

---

### 3. Certificados TLS nao encontrados

**Causa raiz:** O hook busca `port.tls.certificate` e `port.ssl.certificate`, mas a estrutura real dos dados tem:

- `services[].tls.not_after` (nos objetos `web_services`)
- `services[].scripts.ssl-cert` (output textual do nmap com `Not valid after: 2026-05-08T23:59:59`)

A estrutura real e:
```text
{
  "54.146.68.85": {
    "services": [ { port: 443, scripts: { "ssl-cert": "...Not valid after: 2026-05-08..." } } ],
    "web_services": [ { tls: { not_after: "2026-05-08T23:59:59Z", subject_cn: "dealerspace.ai", issuer: ["Amazon"] } } ]
  }
}
```

**Correcao no `src/hooks/useLicensingHub.ts`:**

Reescrever a extracao de certificados TLS para:

1. Iterar `web_services[]` e extrair de `tls.not_after`, `tls.subject_cn`, `tls.issuer`
2. Iterar `services[]` e parsear `scripts["ssl-cert"]` para extrair `Subject: commonName=...`, `Issuer: commonName=...`, `Not valid after: ...`
3. Deduplicar por combinacao de IP + subject_cn (evitar duplicatas entre web_services e services)

---

### 4. M365 sem data de vencimento

**Causa raiz:** O endpoint `/subscribedSkus` da Graph API nao retorna data de expiracao diretamente. O campo `expires_at` e salvo como `null` pela Edge Function.

**Solucao:** Adicionar uma segunda chamada na Edge Function para buscar o endpoint `/organization` ou `/subscribedSkus` + complementar com `/directory/subscriptions` (Microsoft Commerce) que contem datas de renovacao:

- Endpoint: `GET https://graph.microsoft.com/v1.0/directory/subscriptions` (requer `Directory.Read.All`)
- Retorna: `nextLifecycleDateTime`, `status`, `skuPartNumber`

**Correcao no `supabase/functions/m365-tenant-licenses/index.ts`:**

1. Apos buscar `/subscribedSkus`, buscar tambem `/directory/subscriptions`
2. Fazer matching por `skuId` entre os dois endpoints
3. Usar `nextLifecycleDateTime` como `expires_at` na tabela `m365_tenant_licenses`
4. Caso o endpoint `/directory/subscriptions` nao esteja disponivel (403), manter `expires_at` como null (graceful fallback)

---

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `src/pages/LicensingHubPage.tsx` | Adicionar padding `p-6 lg:p-8` |
| `src/hooks/useLicensingHub.ts` | Reescrever extracao de firewalls (usar rawData Unix timestamps) e certificados TLS (usar web_services/scripts) |
| `supabase/functions/m365-tenant-licenses/index.ts` | Adicionar chamada a `/directory/subscriptions` para obter datas de vencimento |

