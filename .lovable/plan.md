

# Corrigir Exibicao de CVEs para SonicWall

## Diagnostico

Dois problemas impedem os CVEs do SonicWall de aparecerem na pagina `/scope-firewall/cves`:

### Problema 1 - Edge Function `agent-task-result`

O codigo ja extrai corretamente os dados de versao do SonicWall para `systemInfo.firmware` (linha 3701), porem o bloco de extracao de `firmwareVersion` (linhas 3751-3807) nunca consulta `systemInfo.firmware` como fallback. Resultado: `report_data.firmwareVersion` fica `NULL` no banco, mesmo quando `report_data.system_info.firmware = "SonicOS 7.3.0-7012"`.

### Problema 2 - Hook `useFirewallCVEs`

O hook so verifica `report_data.firmwareVersion`. Nunca tenta extrair de `report_data.system_info.firmware`. Assim, mesmo que o dado exista em `system_info`, o hook ignora o firewall SonicWall.

## Solucao

### 1. Corrigir `agent-task-result` (prevencao futura)

Adicionar um fallback apos o bloco de extracao (depois da linha 3807):

```text
Se firmwareVersion ainda estiver vazio E systemInfo.firmware existir:
    firmwareVersion = extractFirmwareVersion(systemInfo.firmware)
```

Isso garante que novas execucoes do SonicWall salvem `firmwareVersion` corretamente no `report_data`.

### 2. Corrigir `useFirewallCVEs` (dados existentes + resiliencia)

Na funcao `fetchFirmwareVersions`, alem de verificar `reportData.firmwareVersion`, tambem checar `reportData.system_info.firmware` como fallback:

```text
version = reportData.firmwareVersion
    OU reportData.system_info?.firmware (extraindo apenas o numero, ex: "SonicOS 7.3.0-7012" -> "7.3.0")
```

Isso resolve imediatamente para os dados ja salvos no banco sem necessidade de re-executar analises.

## Arquivos a Modificar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/agent-task-result/index.ts` | Adicionar fallback `systemInfo.firmware` na extracao de `firmwareVersion` |
| `src/hooks/useFirewallCVEs.ts` | Adicionar fallback para `system_info.firmware` ao extrair versao |

## Detalhes Tecnicos

### agent-task-result (apos linha 3807)

Inserir antes do `console.log`:

```text
if (!firmwareVersion && systemInfo.firmware) {
  firmwareVersion = extractFirmwareVersion(systemInfo.firmware as string);
}
```

### useFirewallCVEs - funcao fetchFirmwareVersions

Alterar a extracao de versao (linha ~81) para:

```text
let version = reportData?.firmwareVersion as string | undefined;
if (!version) {
  const sysInfo = reportData?.system_info as { firmware?: string } | undefined;
  if (sysInfo?.firmware) {
    // Extrair numero da versao: "SonicOS 7.3.0-7012" -> "7.3.0"
    const match = sysInfo.firmware.match(/(\d+\.\d+\.?\d*)/);
    version = match ? match[1] : sysInfo.firmware;
  }
}
```

