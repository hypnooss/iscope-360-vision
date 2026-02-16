

# Extrair tecnologias dos scripts NSE do Nmap para badges

## Problema

Atualmente, os badges de tecnologia no header do AssetCard sao alimentados por tres fontes:
- `svc.product` do Nmap (ex: "Apache/2.4.41")
- `ws.server` do httpx (ex: "nginx")
- `ws.technologies` do httpx (ex: "HSTS", "jQuery")

Os dados coletados pelo **nmap-enrich** (scripts NSE como `ssl-cert`, `rdp-ntlm-info`, `smb-os-discovery`) nao sao processados para gerar badges. No exemplo da imagem, o `ssl-cert` mostra `commonName=FortiGate/organizationName=Fortinet Ltd.`, mas nenhum badge "FortiGate" ou "Fortinet" aparece no header do card.

## Solucao

Adicionar um parser que extrai informacoes relevantes dos scripts NSE e as insere no conjunto `techSet` durante a construcao do `allTechs`. O parser cobrira os scripts mais comuns:

| Script NSE | O que extrair | Badge exemplo |
|---|---|---|
| `ssl-cert` | organizationName ou commonName do Subject | `FortiGate`, `Fortinet` |
| `http-server-header` | Nome do servidor | `Apache/2.4.58` |
| `smb-os-discovery` | Nome do OS | `Windows Server 2019` |
| `rdp-ntlm-info` | Product Version ou DNS Domain | `Windows 10.0` |
| `ssh-hostkey` | Tipo de chave | `RSA-2048`, `ED25519` |
| `ftp-syst` | Sistema do FTP | `UNIX` |
| `ms-sql-info` | Versao do SQL Server | `SQL Server 2019` |

## Detalhes tecnicos

### Arquivo a modificar

`src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

### Mudanca

Apos o bloco existente de extracao de techs (linhas 408-415), adicionar um loop pelos `services` que percorre `svc.scripts` e aplica regex/parsing para extrair nomes de tecnologia relevantes:

```typescript
// Extract tech from NSE scripts
for (const svc of result.services || []) {
  const scripts = svc.scripts || {};

  // ssl-cert: extract org/CN from subject
  if (scripts['ssl-cert']) {
    const orgMatch = scripts['ssl-cert'].match(/organizationName=([^\n\/,]+)/i);
    if (orgMatch) techSet.add(orgMatch[1].trim());
    else {
      const cnMatch = scripts['ssl-cert'].match(/commonName=([^\n\/,]+)/i);
      if (cnMatch && !cnMatch[1].includes('*')) techSet.add(cnMatch[1].trim());
    }
  }

  // smb-os-discovery
  if (scripts['smb-os-discovery']) {
    const osMatch = scripts['smb-os-discovery'].match(/OS:\s*(.+)/i);
    if (osMatch) techSet.add(osMatch[1].trim());
  }

  // rdp-ntlm-info
  if (scripts['rdp-ntlm-info']) {
    const prodMatch = scripts['rdp-ntlm-info'].match(/Product_Version:\s*(.+)/i);
    if (prodMatch) techSet.add(`Windows ${prodMatch[1].trim()}`);
  }

  // http-server-header (fallback if no httpx server)
  if (scripts['http-server-header']) {
    techSet.add(scripts['http-server-header'].trim().split('\n')[0]);
  }
}
```

Isso garante que informacoes ricas ja coletadas pelo enriquecimento NSE sejam promovidas a badges visiveis no resumo do ativo, sem alterar nenhum componente visual -- apenas alimentando o `techSet` existente com novas fontes de dados.

### Arquivo

| Arquivo | Acao |
|---|---|
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` | Modificar - adicionar extracao de techs dos scripts NSE no bloco de construcao do `allTechs` (apos linha 415) |

