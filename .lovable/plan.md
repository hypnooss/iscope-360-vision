

# Corrigir filtro de produtos on-premises e deteccao de Customer Action Required

## Problema 1: CVEs de Exchange Server aparecendo

A logica atual filtra CVEs em duas etapas separadas que nao estao coordenadas:

1. `matchesM365Products` verifica se QUALQUER produto do CVE contem patterns como `'outlook'`, `'microsoft office'`
2. `simplifyProductName` tenta remover on-premises depois

O problema: um CVE do "Exchange Server 2019" tambem lista produtos como "Microsoft Outlook 2016" ou "Microsoft Office". O passo 1 aceita o CVE por causa do Outlook, e o passo 2 nao remove porque "Microsoft Outlook" nao e "exchange server".

**Solucao:** Inverter a logica — primeiro simplificar todos os nomes, excluir on-premises, e so entao verificar se sobram produtos cloud validos. Remover da lista `simplifyProductName` o fallback `return name` (linha 170) que aceita qualquer produto desconhecido — trocar por `return null` para rejeitar produtos nao-mapeados.

## Problema 2: Customer Action Required sempre 0

A funcao `extractCustomerActionRequired` verifica o texto "customer action" nas remediations e depois checa se existe VendorFix automatico. O problema e que a maioria dos CVEs cloud tem remediations com Type=2 e SubType="Security Update" para os produtos on-premises associados, fazendo `hasAutoFix = true` e retornando `false` para todos.

**Solucao:** Ajustar a logica para ser mais precisa:
- Verificar se alguma remediacao contem explicitamente o texto "customer action required" (case insensitive) no campo `Description.Value` OU no `SubType`
- Verificar tambem o array `Flags` da vulnerabilidade (campo usado pelo MSRC para marcar acoes do cliente)
- Para CVEs cloud sem remediacao especifica listada (sem VendorFix para os produtos cloud filtrados), marcar como `true`

## Alteracoes tecnicas

### Arquivo: `supabase/functions/m365-cves/index.ts`

**1. `simplifyProductName` (linha 170):** Trocar `return name` por `return null` — rejeitar qualquer produto nao reconhecido como cloud M365.

**2. Reordenar logica no loop principal (linhas 218-255):**
- Mover `simplifyProductName` + filtro para ANTES do `matchesM365Products`
- Remover `matchesM365Products` da decisao principal (nao e mais necessario; a simplificacao ja filtra)
- Manter a verificacao: se `simplifiedProducts.length === 0`, pular o CVE

**3. `extractCustomerActionRequired` (linhas 129-150):** Refinar para:
- Checar texto "customer action" em remediations (manter)
- Checar campo `vuln.Flags` para indicadores de acao
- Inverter default: se nao ha VendorFix especifico para os produtos cloud do CVE, considerar acao necessaria
- Considerar tambem que CVEs puramente cloud (SaaS) geralmente NAO requerem acao (Microsoft gerencia), exceto quando explicitamente indicado

### Arquivo: `src/hooks/useM365CVEs.ts`
- Sem alteracoes (interface ja tem `customerActionRequired`)

### Arquivo: `src/pages/m365/M365CVEsPage.tsx`
- Sem alteracoes (UI ja tem stat card, badge e filtro)

Apos as alteracoes, reimplantar a edge function `m365-cves` e testar via curl.

