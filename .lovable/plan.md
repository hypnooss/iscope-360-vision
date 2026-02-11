

# Suporte Multi-Vendor para CVEs de Firewall

## Problema

A Edge Function `fortigate-cve` e a pagina `FirewallCVEsPage` estao 100% hardcoded para FortiOS/Fortinet. Se um firewall SonicWall for cadastrado, seus CVEs nao serao buscados, e a interface sempre exibe "CVEs - FortiOS" e links para Fortiguard PSIRT.

## Dados atuais no banco

- **Fortinet (FortiGate)**: 13 firewalls, varios com firmware analisado (7.2.x, 7.4.x)
- **SonicWall**: 1 firewall cadastrado (sem analise ainda, firmware_version = null)
- Tabela `device_types` ja tem os dois vendors com codigos `fortigate` e `sonicwall`

## Solucao

Tornar a busca de CVEs generica, passando o `vendor` junto com a `version` para a Edge Function, que usara o CPE e keyword corretos para cada vendor no NVD.

### Mapeamento de vendors para NVD

| Vendor | CPE vendor | CPE product | Keyword | Advisory link |
|---|---|---|---|---|
| Fortinet | fortinet | fortios | FortiOS | fortiguard.com/psirt |
| SonicWall | sonicwall | sonicos | SonicOS | psirt.global.sonicwall.com |

## Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/fortigate-cve/index.ts` | Aceitar parametro `vendor` (default: `fortinet`), usar CPE e keywords dinamicos por vendor, tornar filtro de descricao generico |
| `src/hooks/useFirewallCVEs.ts` | Buscar `device_type_id` de cada firewall para determinar o vendor, passar vendor na chamada da Edge Function |
| `src/pages/firewall/FirewallCVEsPage.tsx` | Tornar titulo, disclaimer e links de advisory dinamicos conforme vendors presentes |

## Detalhes tecnicos

### Edge Function `fortigate-cve`

Receber `{ version, vendor? }` no body. Mapear vendor para configuracao NVD:

```text
VENDOR_CONFIG = {
  fortinet: {
    cpeVendor: 'fortinet',
    cpeProduct: 'fortios',
    cpeType: 'o',           // operating system
    keyword: 'FortiOS',
    descriptionFilter: 'fortios',
  },
  sonicwall: {
    cpeVendor: 'sonicwall',
    cpeProduct: 'sonicos',
    cpeType: 'o',
    keyword: 'SonicOS',
    descriptionFilter: 'sonicos',
  },
}
```

- Substituir CPE hardcoded por `cpe:2.3:{type}:{cpeVendor}:{cpeProduct}:{version}:...`
- Substituir keyword hardcoded `FortiOS {majorMinor}` por `{keyword} {majorMinor}`
- Substituir filtro `.includes('fortios')` por `.includes(descriptionFilter)`
- Renomear funcao `extractFortiOSInfo` para `extractVendorInfo` e parametrizar o nome do produto
- Ajustar disclaimer para mencionar o vendor correto

### Hook `useFirewallCVEs`

Alterar `fetchFirmwareVersions` para retornar tambem o vendor de cada versao:

```text
Retorno atual:  string[]             (ex: ["7.2.8", "7.4.11"])
Retorno novo:   { version, vendor }[] (ex: [{ version: "7.2.8", vendor: "fortinet" }, { version: "7.0.1", vendor: "sonicwall" }])
```

Para isso:
1. Buscar firewalls com JOIN no `device_types` para obter o vendor: `supabase.from('firewalls').select('id, device_types(vendor)')`
2. Criar mapa `firewall_id -> vendor`
3. Ao extrair firmware de `analysis_history`, associar o vendor do firewall correspondente
4. Passar `vendor` na chamada: `supabase.functions.invoke('fortigate-cve', { body: { version, vendor } })`
5. Adicionar campo `vendor` ao tipo `FirewallCVE` para uso na UI

### Pagina `FirewallCVEsPage`

- Titulo: se houver apenas um vendor, exibir "CVEs - FortiOS" ou "CVEs - SonicOS"; se houver ambos, exibir "CVEs - Firewalls"
- Badge no card de CVE: trocar label hardcoded "FortiOS {version}" por "{osLabel} {version}" (FortiOS ou SonicOS)
- Disclaimer: dinamico conforme vendors presentes ("advisories oficiais da Fortinet/SonicWall")
- Link de advisory: para SonicWall, apontar para `psirt.global.sonicwall.com` em vez de Fortiguard
- Filtro de versao: adicionar indicador visual do vendor (ex: prefixo "FortiOS 7.2.8" / "SonicOS 7.0.1")

