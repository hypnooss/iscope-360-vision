

# Inverter logica de "Customer Action Required"

## Problema

A logica atual esta invertida. No contexto de produtos cloud/SaaS do Microsoft 365:

- CVEs que listam remediacao "Security Update" (VendorFix Type=2) sao patches para aplicativos **client-side** (Office desktop, Outlook desktop) que precisam ser instalados pelo cliente/admin via WSUS, Intune ou Windows Update. Esses **requerem acao**.
- CVEs que **nao** listam VendorFix sao vulnerabilidades corrigidas diretamente no backend SaaS pela Microsoft (Exchange Online, SharePoint Online, Entra ID). Esses **nao requerem acao**.

Exemplo:
- CVE-2025-55241: Nao tem VendorFix client-side, e um fix server-side automatico da Microsoft. Hoje mostra "Acao Necessaria" (errado).
- CVE-2025-62554: Tem VendorFix "Security Update" que o admin precisa aplicar. Hoje nao mostra (errado).

## Solucao

Inverter a logica final na funcao `extractCustomerActionRequired`:

```
Logica corrigida:
1. Se Flags ou Remediations mencionam "customer action" explicitamente -> true (manter)
2. Se nao ha Remediations -> false (SaaS fix automatico, nao assume acao)  
3. Se existe VendorFix com "Security Update" -> true (patch client-side, admin precisa aplicar)
4. Se nao existe VendorFix -> false (fix automatico server-side)
```

## Alteracao tecnica

**Arquivo:** `supabase/functions/m365-cves/index.ts`

Na funcao `extractCustomerActionRequired` (linhas 145-190):

1. **Linha 156-158**: Mudar o default quando nao ha remediations de `true` para `false` (sem info = provavelmente fix automatico SaaS)

2. **Linhas 181-189**: Inverter o retorno final:
   - Atual: `return !hasCloudAutoFix` (se tem auto-fix, nao requer acao)
   - Corrigido: `return hasCloudAutoFix` (se tem VendorFix/Security Update, requer acao do cliente para aplicar o patch)

Reimplantar edge function `m365-cves` apos alteracao.

