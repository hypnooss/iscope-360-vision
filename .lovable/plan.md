

# Filtrar apenas produtos Online e adicionar "Customer Action Required"

## Problema atual

1. Os patterns de filtragem (`exchange server`, `sharepoint`) capturam CVEs de produtos on-premises (Exchange Server 2016/2019, SharePoint Server) que nao pertencem ao Office 365 cloud.
2. Nao existe extracao do campo "Customer Action Required" dos dados MSRC, que indica CVEs onde o cliente precisa tomar uma acao manual.

## Solucao

### 1. Edge Function — Filtro preciso de produtos cloud

**Arquivo:** `supabase/functions/m365-cves/index.ts`

Substituir os patterns genericos por nomes exatos dos produtos cloud do MSRC Product Tree:

```text
Patterns atuais (incorretos):
  'exchange server'    -> captura Exchange Server 2016, 2019, etc.
  'sharepoint'         -> captura SharePoint Server 2016, 2019, etc.

Novos patterns (corretos):
  'exchange online'           -> apenas Exchange Online (Office 365)
  'sharepoint online'         -> apenas SharePoint Online (Office 365)
  'microsoft 365 apps'        -> Microsoft 365 Apps for Enterprise
  'microsoft office'           -> (mantido, cobre Office LTSC ligado ao 365)
  'entra'                      -> Entra ID
  'azure active directory'     -> Azure AD (legado)
  'microsoft teams'            -> Teams
  'outlook'                    -> Outlook (web/desktop 365)
  'defender'                   -> Defender for Endpoint/Office 365
  'intune'                     -> Intune
  'onedrive'                   -> OneDrive for Business
  'microsoft 365'              -> generico M365
```

### 2. Edge Function — Extrair "Customer Action Required"

No CVRF, cada vulnerabilidade tem um array `Remediations`. Quando existe uma remediacao do tipo `VendorFix` (Type=2) com `SubType` contendo "Security Update" que e distribuida automaticamente via Windows Update/Microsoft Update, nao requer acao do cliente. Quando a remediacao indica "Customer Action" na descricao ou nao possui fix automatico, o campo sera `true`.

Nova funcao `extractCustomerActionRequired(vuln)`:
- Percorre `vuln.Remediations`
- Verifica se existe indicacao de "Customer Action Required" no campo `Description.Value` ou `SubType`
- Se nenhum VendorFix automatico for encontrado para os produtos filtrados, marca como `customerActionRequired: true`

Adicionar o campo `customerActionRequired: boolean` ao retorno de cada CVE.

### 3. Frontend — Novo stat card e badge

**Arquivo:** `src/hooks/useM365CVEs.ts`
- Adicionar `customerActionRequired: boolean` na interface `M365CVE`

**Arquivo:** `src/pages/m365/M365CVEsPage.tsx`
- Novo StatCard "Acao Necessaria" contando CVEs com `customerActionRequired === true`
- Badge visual no CVECard indicando "Acao Necessaria" (cor laranja/destaque)
- Novo filtro rapido para mostrar apenas CVEs com acao necessaria

### 4. Resumo de alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/m365-cves/index.ts` | Patterns cloud-only, extracao de customerActionRequired |
| `src/hooks/useM365CVEs.ts` | Novo campo na interface |
| `src/pages/m365/M365CVEsPage.tsx` | Stat card, badge e filtro de acao necessaria |

Apos as alteracoes, reimplantar a edge function `m365-cves`.

