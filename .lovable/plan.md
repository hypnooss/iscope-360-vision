
# Plano: Correção do Card de Vulnerabilidades (CVEs) Ausente

## Diagnóstico

Após investigação detalhada no banco de dados, identifiquei a causa raiz do problema:

### Dados Encontrados
| Campo | Valor |
|-------|-------|
| `raw_data.system_firmware.version` | `"v7.2.10"` |
| `raw_data.system_firmware.results.current.version` | `"v7.2.10"` |
| `report_data.firmwareVersion` | `null` (não foi extraído!) |

### Causa Raiz
A edge function `agent-task-result` não está extraindo corretamente a versão do firmware dos dados brutos porque:
1. O Source 1 (`system_status.results.version`) não existe nos dados
2. O Source 2 verifica `fwObj.current` (que não existe) antes de `fwObj.version` (que existe!)
3. O Source 3 (fallback genérico) deveria pegar, mas a ordem de verificação pode estar causando problemas

---

## Solução

### Modificação na Edge Function `agent-task-result`

Atualizar o bloco Source 2 (linhas 270-278) para verificar `system_firmware.version` diretamente ANTES de tentar caminhos aninhados:

```text
// Source 2: system_firmware - multiple paths
if (!firmwareVersion && systemFirmware) {
  const fwObj = systemFirmware as Record<string, unknown>;
  
  // Direct version field (most common in FortiOS API responses)
  if (fwObj.version) {
    firmwareVersion = extractFirmwareVersion(fwObj.version);
  }
  
  // Nested: results.current.version
  if (!firmwareVersion) {
    const resultsObj = fwObj.results as Record<string, unknown> | undefined;
    const current = (fwObj.current || resultsObj?.current) as Record<string, unknown> | undefined;
    if (current?.version) {
      firmwareVersion = extractFirmwareVersion(current.version);
    }
  }
}
```

### Arquivo Afetado
- `supabase/functions/agent-task-result/index.ts` (linhas 270-278)

---

## Fluxo de Dados Esperado

```text
+------------------+     +-----------------------+     +-------------------+
|  Agente coleta   | --> | agent-task-result     | --> | analysis_history  |
|  system_firmware |     | extrai firmwareVersion|     | firmwareVersion   |
+------------------+     +-----------------------+     +-------------------+
                                                              |
                                                              v
                                                     +-------------------+
                                                     | Dashboard.tsx     |
                                                     | renderiza         |
                                                     | CVESection        |
                                                     +-------------------+
```

---

## Passos de Implementação

1. **Atualizar `agent-task-result/index.ts`**
   - Modificar o bloco Source 2 (linhas 270-278)
   - Adicionar verificação direta de `fwObj.version` como primeira opção
   - Manter fallbacks existentes para compatibilidade

2. **Deploy da Edge Function**
   - A função será deployada automaticamente

3. **Testar**
   - Executar uma nova análise de firewall
   - Verificar se `firmwareVersion` é preenchido no `analysis_history`
   - Confirmar que o card de CVEs aparece no Dashboard

---

## Impacto Visual

Após a correção, a página de análise de compliance exibirá:

```text
+--------------------------------------------------+
| CVEs Conhecidos - FortiOS 7.2.10                 |
| Vulnerabilidades públicas registradas no NIST NVD|
|                                                  |
|  [CRITICAL] CVE-2024-XXXXX (9.8)                |
|  [HIGH] CVE-2024-YYYYY (7.5)                    |
|  ...                                             |
+--------------------------------------------------+
```

---

## Observação Importante

As análises existentes no banco **não serão automaticamente corrigidas**. O campo `firmwareVersion` só será preenchido em **novas análises** realizadas após o deploy desta correção.

Para ver o card de vulnerabilidades, será necessário:
1. Aguardar o deploy da correção
2. Executar uma nova análise clicando em "Reanalisar"
