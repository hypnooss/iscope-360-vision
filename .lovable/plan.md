

# Exibir dados enriquecidos do Nmap no frontend (scripts, extra_info)

## Problema

O executor `nmap.py` coleta dados valiosos via scripts NSE (como `rdp-ntlm-info`, `rdp-enum-encryption`, `ssh-hostkey`, `ssl-cert`, etc.) e campos adicionais (`extra_info`, `name`). Porem, a interface do `AttackSurfaceService` no frontend nao inclui esses campos, e o componente `NmapServiceRow` nao renderiza essas informacoes. Os dados estao no banco, mas sao ignorados pelo frontend.

## Dados que o nmap coleta mas o frontend ignora

- `scripts`: dicionario com saida de cada script NSE (ex: `rdp-ntlm-info` traz versao do Windows, nome do servidor, dominio)
- `extra_info`: informacoes adicionais do fingerprint (ex: "Windows Server 2019")
- `name`: nome do servico detectado (ex: "ms-wbt-server" para RDP)

## Plano Tecnico

### 1. Atualizar a interface `AttackSurfaceService` (`src/hooks/useAttackSurfaceData.ts`)

Adicionar os campos que o nmap retorna:

```typescript
export interface AttackSurfaceService {
  port: number;
  transport: string;
  product: string;
  version: string;
  banner: string;
  cpe: string[];
  name?: string;           // NOVO: nome do servico (ex: "ms-wbt-server")
  extra_info?: string;     // NOVO: info adicional do fingerprint
  scripts?: Record<string, string>;  // NOVO: saida dos scripts NSE
}
```

### 2. Atualizar o componente `NmapServiceRow` (`src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`)

Exibir os novos campos no card do servico:

- Mostrar `extra_info` ao lado da versao (texto secundario)
- Adicionar uma secao expansivel mostrando a saida de cada script NSE como pares chave/valor
- Tornar o card clicavel para expandir os scripts (mesmo sem CVEs)

Exemplo visual apos a mudanca:

```text
+-----------------------------------------------------------+
| 3389/tcp  Microsoft Terminal Services                      |
|           Windows Server 2019 Standard (extra_info)        |
+-----------------------------------------------------------+
|  rdp-ntlm-info:                                           |
|    Target_Name: CONTOSO                                    |
|    NetBIOS_Domain: CONTOSO                                 |
|    DNS_Computer: SRV01.contoso.local                       |
|    Product_Version: 10.0.17763                             |
|  rdp-enum-encryption:                                      |
|    Security layer: CredSSP (NLA)                           |
|    RDP Encryption level: High                              |
+-----------------------------------------------------------+
```

### 3. Logica de expansao

Atualmente o `NmapServiceRow` so expande quando ha CVEs. Precisa ser ajustado para tambem expandir quando houver `scripts` com conteudo. O click toggle mostrara:
- Scripts NSE formatados (se existirem)
- CVEs (se existirem)

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useAttackSurfaceData.ts` | Adicionar `name`, `extra_info`, `scripts` ao `AttackSurfaceService` |
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` | Atualizar `NmapServiceRow` para exibir `extra_info` e scripts NSE expandiveis |

## Resultado esperado

Apos a mudanca, o card do RDP mostrara todas as informacoes coletadas pelo nmap, incluindo versao do Windows, nome do servidor, dominio, nivel de criptografia e demais dados dos scripts NSE.

