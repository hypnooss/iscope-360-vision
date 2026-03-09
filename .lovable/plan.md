

# Nova coleta: WHOIS de Domínio (com data de expiração)

## Contexto

Os dados exibidos no tooltip do Surface Analyzer (Owner, OwnerID, Responsible) vêm do **WHOIS de IP** (`asn_classifier.py`). Isso retorna informações do bloco de rede, **não do registro do domínio**. Datas de expiração de domínio não são coletadas por nenhum componente atual.

## O que precisa ser feito

### 1. Criar Edge Function `domain-whois-lookup`

Consultar RDAP por **domínio** (não por IP). Endpoints:
- `.br`: `https://rdap.registro.br/domain/{domain}`
- Genérico: `https://rdap.org/domain/{domain}`

Extrair do JSON RDAP:
- `expirationDate` (campo `events` com `eventAction: "expiration"`)
- `registrationDate` (evento `"registration"`)
- `lastChanged` (evento `"last changed"`)
- Registrar name (entidade com role `"registrar"`)

### 2. Migration: adicionar colunas na tabela `external_domains`

```sql
ALTER TABLE external_domains ADD COLUMN IF NOT EXISTS whois_registrar text;
ALTER TABLE external_domains ADD COLUMN IF NOT EXISTS whois_expires_at timestamptz;
ALTER TABLE external_domains ADD COLUMN IF NOT EXISTS whois_created_at timestamptz;
ALTER TABLE external_domains ADD COLUMN IF NOT EXISTS whois_checked_at timestamptz;
```

### 3. Integrar no pipeline de análise

Chamar a edge function durante `trigger-external-domain-analysis` para cada domínio, salvando os dados WHOIS na tabela.

### 4. Nova aba "Domínios Externos" na Gestão de Ativos (`LicensingHubPage`)

Tabela com: Domínio | Registrar | Expiração | Status (badge com cores: expirado/expirando em 30d/ativo). Reutilizar o componente `ExpiryBadge` existente.

### Arquivos envolvidos
- **Novo**: `supabase/functions/domain-whois-lookup/index.ts`
- **Migration**: colunas WHOIS em `external_domains`
- **Alterar**: `supabase/functions/trigger-external-domain-analysis/index.ts` — invocar WHOIS
- **Alterar**: `src/pages/LicensingHubPage.tsx` — nova aba
- **Alterar**: `src/hooks/useLicensingHub.ts` — query de domínios

