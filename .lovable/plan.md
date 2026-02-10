

# Corrigir filtragem de CVEs on-premises e deteccao de Customer Action

## Problema raiz

### 1. CVEs de SharePoint Server / Exchange Server ainda aparecem

Um CVE como "Microsoft SharePoint Server Remote Code Execution Vulnerability" lista multiplos produtos no MSRC Product Tree:
- `Microsoft SharePoint Server 2019` (corretamente rejeitado como null)
- `Microsoft Office LTSC 2021 for 32-bit editions` (incorretamente mapeado para "Microsoft 365 Apps")
- `Microsoft 365 Apps for Enterprise` (incorretamente mapeado para "Microsoft 365 Apps")

O filtro atual remove "SharePoint Server" mas aceita o CVE por causa dos produtos Office/365 Apps compartilhados. O CVE passa com o label "Microsoft 365 Apps" quando na verdade e uma vulnerabilidade de SharePoint Server.

### 2. Customer Action Required sempre 0

A funcao `hasCloudAutoFix` sempre retorna `true` porque a condicao na linha 187-189 e logicamente incorreta — `rem.ProductID && Array.isArray(rem.ProductID)` e sempre verdadeiro ja que toda remediacao tem um array de ProductIDs.

## Solucao

### Alteracao 1: Filtrar pelo titulo do CVE (nova camada de defesa)

Adicionar verificacao do `vuln.Title.Value` antes de processar os produtos. Se o titulo contem indicadores claros de on-premises, rejeitar o CVE inteiro:

```
Rejeitar se titulo contem:
- "SharePoint Server"
- "SharePoint Enterprise Server" 
- "SharePoint Foundation"
- "Exchange Server"
- "Windows Server"
- "Skype for Business Server"
- "Lync Server"
```

Isso impede que CVEs de servidor passem mesmo quando listam produtos genericos como "Microsoft Office".

### Alteracao 2: Refinar `simplifyProductName` para rejeitar produtos ambiguos em contexto de servidor

Manter a logica atual, mas o titulo do CVE sera a barreira principal. Produtos como "Microsoft 365 Apps" e "Microsoft Office" continuam sendo aceitos para CVEs genuinamente cloud.

### Alteracao 3: Corrigir `extractCustomerActionRequired`

A logica atual na linha 181-193 e defeituosa. Corrigir para:

1. Manter checagens de `Flags` e texto "customer action" (linhas 147-176) — estas funcionam
2. Corrigir a verificacao de auto-fix: em vez de checar se ProductID existe (sempre true), verificar se o `SubType` do VendorFix realmente indica patch automatico vs manual
3. Para CVEs cloud/SaaS sem remediacao explicita do tipo VendorFix, manter `customerActionRequired = true`

## Arquivo modificado

`supabase/functions/m365-cves/index.ts`

### Mudanca 1 — Novo filtro por titulo (no loop principal, antes de getProductNames)

```typescript
// Antes de processar produtos, verificar titulo do CVE
const cveTitle = (vuln.Title?.Value || '').toLowerCase();
const onPremTitlePatterns = [
  'sharepoint server', 'sharepoint enterprise server', 'sharepoint foundation',
  'exchange server', 'windows server', 'skype for business server', 'lync server'
];
if (onPremTitlePatterns.some(p => cveTitle.includes(p))) continue;
```

### Mudanca 2 — Corrigir hasCloudAutoFix

Substituir a logica das linhas 181-193. A condicao `rem.ProductID && Array.isArray(rem.ProductID) return true` deve ser removida. Em vez disso, considerar que para produtos cloud (SaaS), se existe um VendorFix generico com SubType "Security Update" e nenhuma indicacao explicita de acao do cliente, o patch e automatico:

```typescript
const hasCloudAutoFix = vuln.Remediations.some((rem: any) => {
  if (rem.Type !== 2) return false;
  const subType = (rem.SubType || '').toLowerCase();
  return subType.includes('security update');
});
return !hasCloudAutoFix;
```

## Resumo

| Alteracao | Efeito |
|-----------|--------|
| Filtro por titulo do CVE | Rejeita CVEs de SharePoint Server, Exchange Server mesmo quando listam produtos genericos |
| Correcao hasCloudAutoFix | Customer Action Required agora funciona corretamente para CVEs cloud |

Apos alteracoes, reimplantar `m365-cves` e testar via curl.

