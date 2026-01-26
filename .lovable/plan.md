

# Plano: Correção da Verificação de Versão de Firmware (fw-001)

## Resumo do Problema

Na categoria "Atualizações e Firmware", o check **Versão de Firmware** (`fw-001`) não está funcionando corretamente:

| Sintoma | Causa |
|---------|-------|
| Dropdown não abre | Não há `evidence` sendo gerada (array vazio) |
| Exibe "Valor: undefined" | O `evaluation_logic` busca em `results.version`, mas a versão está no nível raiz (`version`) |
| Sem dados brutos | `rawData` está vazio porque `value` é `undefined` |

### Análise dos Dados Coletados

O endpoint `/api/v2/monitor/system/status` retorna a seguinte estrutura:

```json
{
  "version": "v7.2.10",        // <-- Versão está aqui (nível raiz)
  "serial": "FGT40FTK21045571",
  "build": 1706,
  "results": {
    "hostname": "SAO-FW",
    "model": "FGT40F",
    "model_name": "FortiGate"
    // version NÃO está dentro de results!
  }
}
```

A regra `fw-001` está configurada com:
```json
{
  "source_key": "system_status",
  "field_path": "results.version"  // <-- ERRADO! Deveria ser "version"
}
```

---

## Alterações Necessárias

### 1. Atualizar `evaluation_logic` da Regra no Banco de Dados

Corrigir o `field_path` de `results.version` para `version`:

```sql
UPDATE compliance_rules 
SET evaluation_logic = jsonb_set(
  evaluation_logic,
  '{field_path}',
  '"version"'::jsonb
)
WHERE code = 'fw-001';
```

### 2. Criar Formatador `formatFirmwareEvidence`

Nova funcao na Edge Function para formatar `fw-001`:

```typescript
function formatFirmwareEvidence(
  rawData: Record<string, unknown>
): { evidence: EvidenceItem[], firmwareInfo: Record<string, unknown>, status: 'pass' | 'fail' | 'warn' } {
  const evidence: EvidenceItem[] = [];
  const firmwareInfo: Record<string, unknown> = {};
  
  try {
    const systemStatus = rawData['system_status'] as Record<string, unknown> | undefined;
    
    if (!systemStatus) {
      evidence.push({ label: 'Status', value: 'Dados nao disponiveis', type: 'text' });
      return { evidence, firmwareInfo, status: 'warn' };
    }
    
    // Extrair versao do nivel raiz
    const version = systemStatus.version as string || '';
    const serial = systemStatus.serial as string || '';
    const build = systemStatus.build as number | string || '';
    
    // Extrair dados de results
    const results = systemStatus.results as Record<string, unknown> || {};
    const hostname = results.hostname as string || '';
    const model = results.model || results.model_name || '';
    
    // Popular firmwareInfo para rawData
    firmwareInfo.version = version;
    firmwareInfo.build = build;
    firmwareInfo.serial = serial;
    firmwareInfo.hostname = hostname;
    firmwareInfo.model = model;
    
    // Gerar evidencias amigaveis
    if (version) {
      // Extrair versao limpa (ex: "v7.2.10" -> "7.2.10")
      const cleanVersion = version.replace(/^v/i, '');
      
      evidence.push({
        label: 'Versao do Firmware',
        value: version,
        type: 'code'
      });
      
      if (build) {
        evidence.push({
          label: 'Build',
          value: String(build),
          type: 'text'
        });
      }
      
      if (model) {
        evidence.push({
          label: 'Modelo',
          value: String(model),
          type: 'text'
        });
      }
      
      if (hostname) {
        evidence.push({
          label: 'Hostname',
          value: String(hostname),
          type: 'text'
        });
      }
      
      if (serial) {
        evidence.push({
          label: 'Numero de Serie',
          value: serial,
          type: 'code'
        });
      }
      
      // Determinar status baseado na versao
      // Versoes 7.2.x e 7.4.x sao consideradas atuais
      // Versoes 7.0.x ou anteriores sao warning
      // Versoes 6.x ou anteriores sao fail
      const majorMinor = cleanVersion.match(/^(\d+)\.(\d+)/);
      let status: 'pass' | 'fail' | 'warn' = 'warn';
      
      if (majorMinor) {
        const major = parseInt(majorMinor[1]);
        const minor = parseInt(majorMinor[2]);
        
        if (major >= 7 && minor >= 2) {
          status = 'pass';
          evidence.push({
            label: 'Status',
            value: '✅ Versao atual e suportada',
            type: 'text'
          });
        } else if (major >= 7) {
          status = 'warn';
          evidence.push({
            label: 'Status',
            value: '⚠️ Versao suportada, considerar atualizacao',
            type: 'text'
          });
        } else {
          status = 'fail';
          evidence.push({
            label: 'Status',
            value: '❌ Versao desatualizada - risco de seguranca',
            type: 'text'
          });
        }
      }
      
      return { evidence, firmwareInfo, status };
    } else {
      evidence.push({ label: 'Status', value: '⚠️ Versao nao identificada', type: 'text' });
      return { evidence, firmwareInfo, status: 'warn' };
    }
    
  } catch (e) {
    console.error('Error formatting firmware evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar dados', type: 'text' });
    return { evidence, firmwareInfo, status: 'warn' };
  }
}
```

### 3. Integrar Formatador no Processamento

Adicionar branch no switch de regras (apos `int-*`, antes do fallback generico):

```typescript
} else if (rule.code === 'fw-001') {
  // Firmware Version rule
  fwResult = formatFirmwareEvidence(rawData);
  evidence = fwResult.evidence;
  status = fwResult.status;
  if (status === 'pass') {
    details = rule.pass_description || 'Firmware na versao recomendada';
  } else if (status === 'fail') {
    details = rule.fail_description || 'Firmware desatualizado';
  } else {
    details = 'Versao de firmware requer verificacao';
  }
}
```

### 4. Controlar Raw Data para fw-001

Adicionar tratamento de rawData para a regra:

```typescript
} else if (rule.code === 'fw-001' && fwResult) {
  // Para fw-001, incluir dados de firmware resumidos
  checkRawData = {
    firmware_info: fwResult.firmwareInfo
  };
}
```

### 5. Declarar Variavel `fwResult`

Adicionar declaracao junto com as outras variaveis de resultado:

```typescript
let fwResult: { evidence: EvidenceItem[], firmwareInfo: Record<string, unknown>, status: 'pass' | 'fail' | 'warn' } | null = null;
```

---

## Arquivos Modificados

1. **`supabase/functions/agent-task-result/index.ts`**
   - Adicionar funcao `formatFirmwareEvidence`
   - Integrar no switch de processamento de regras
   - Adicionar tratamento de rawData para fw-001
   - Declarar variavel `fwResult`

2. **Banco de Dados (SQL via ferramenta de insercao)**
   - Corrigir `field_path` de `results.version` para `version` na regra `fw-001`

---

## Resultado Esperado

### Antes (Problema)
```
Versao de Firmware
  [Dropdown nao abre]
  Status: warning
  Details: Valor: undefined
  Evidence: (vazio)
  RawData: (vazio)
```

### Depois (Corrigido)
```
Versao de Firmware
  [Dropdown abre normalmente]
  Status: pass (para v7.2.x+) ou warn/fail (versoes antigas)
  Details: Firmware na versao recomendada
  Evidence:
    - Versao do Firmware: v7.2.10
    - Build: 1706
    - Modelo: FGT40F
    - Hostname: SAO-FW
    - Numero de Serie: FGT40FTK21045571
    - Status: ✅ Versao atual e suportada
  RawData:
    {
      "firmware_info": {
        "version": "v7.2.10",
        "build": 1706,
        "model": "FGT40F",
        "hostname": "SAO-FW",
        "serial": "FGT40FTK21045571"
      }
    }
```

---

## Logica de Avaliacao de Versao

| Versao | Status | Descricao |
|--------|--------|-----------|
| 7.2.x ou superior | pass | Versao atual e suportada |
| 7.0.x ou 7.1.x | warn | Suportada, considerar atualizacao |
| 6.x ou inferior | fail | Desatualizada, risco de seguranca |

---

## Complexidade

Baixa - Criacao de formatador especializado seguindo padrao existente + correcao de field_path no banco

