

# Plano: Usar Dados Dinâmicos do FortiGuard (Sem Mapa Hardcoded)

## Problema com a Abordagem Atual

O mapa `matureVersions` hardcoded é:
1. **Propenso a erros** - já errei colocando 7.2.10 quando era 7.2.12
2. **Impossível de manter** - quem vai atualizar isso a cada 2-3 meses?
3. **Desnecessário** - o próprio FortiGate já retorna essa informação!

## Dados Já Disponíveis

O endpoint `/api/v2/monitor/system/firmware` retorna:

```json
{
  "current": {
    "version": "v7.2.10",
    "major": 7, "minor": 2, "patch": 10,
    "maturity": "M"
  },
  "available": [
    { "version": "v7.2.12", "major": 7, "minor": 2, "patch": 12, "maturity": "M" },
    { "version": "v7.2.11", "major": 7, "minor": 2, "patch": 11, "maturity": "M" },
    { "version": "v7.4.10", "major": 7, "minor": 4, "patch": 10, "maturity": "M" },
    // ... todas as versões disponíveis do FortiGuard
  ]
}
```

## Nova Lógica Proposta

1. **Extrair versão atual** do campo `current`
2. **Filtrar versões disponíveis** do mesmo branch (mesmo major.minor)
3. **Encontrar a última mature** do branch (maior patch com `maturity: "M"`)
4. **Comparar** versão instalada vs última mature disponível

## Regras de Avaliação

| Situação | Status | Severidade |
|----------|--------|------------|
| Versão instalada = última mature do branch | `pass` | - |
| Versão instalada < última mature do branch | `fail` | HIGH |
| Nenhuma versão disponível encontrada | `warn` | MEDIUM |

## Alterações Necessárias

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

**Função:** `formatFirmwareEvidence`

### Código Proposto:

```typescript
function formatFirmwareEvidence(rawData: unknown): { 
  evidence: Evidence[], 
  firmwareInfo: FirmwareInfo, 
  status: 'pass' | 'fail' | 'warn' 
} {
  const evidence: Evidence[] = [];
  const firmwareInfo: FirmwareInfo = {};
  
  // ... código existente para extrair version, build, model, etc ...
  
  // Extrair dados do system_firmware
  const systemFirmware = findDataByKey(rawData, ['system_firmware']);
  let availableVersions: Array<{
    version: string;
    major: number;
    minor: number;
    patch: number;
    maturity: string;
  }> = [];
  
  if (systemFirmware) {
    const fwData = systemFirmware as Record<string, unknown>;
    const results = fwData.results as Record<string, unknown> || fwData;
    const available = results.available as Array<Record<string, unknown>> || [];
    
    availableVersions = available.map(v => ({
      version: String(v.version || ''),
      major: Number(v.major || 0),
      minor: Number(v.minor || 0),
      patch: Number(v.patch || 0),
      maturity: String(v.maturity || '')
    }));
  }
  
  if (version) {
    const cleanVersion = version.replace(/^v/i, '');
    
    // Evidências simplificadas
    evidence.push({ label: 'Versão do Firmware', value: version, type: 'code' });
    if (build) evidence.push({ label: 'Build', value: String(build), type: 'text' });
    
    // Extrair major.minor.patch da versão atual
    const versionParts = cleanVersion.match(/^(\d+)\.(\d+)\.?(\d+)?/);
    let status: 'pass' | 'fail' | 'warn' = 'warn';
    
    if (versionParts) {
      const currentMajor = parseInt(versionParts[1]);
      const currentMinor = parseInt(versionParts[2]);
      const currentPatch = parseInt(versionParts[3] || '0');
      
      // Filtrar versões mature do mesmo branch
      const sameBranchMature = availableVersions
        .filter(v => 
          v.major === currentMajor && 
          v.minor === currentMinor && 
          v.maturity === 'M'
        )
        .sort((a, b) => b.patch - a.patch);
      
      if (sameBranchMature.length > 0) {
        const latestMature = sameBranchMature[0];
        
        if (currentPatch >= latestMature.patch) {
          status = 'pass';
          evidence.push({ 
            label: 'Status', 
            value: `✅ Última versão mature do branch ${currentMajor}.${currentMinor}`, 
            type: 'text' 
          });
        } else {
          status = 'fail';
          evidence.push({ 
            label: 'Status', 
            value: `❌ Atualização disponível: ${latestMature.version}`, 
            type: 'text' 
          });
        }
      } else {
        // Sem versões disponíveis para comparar
        status = 'warn';
        evidence.push({ 
          label: 'Status', 
          value: `⚠️ Não foi possível verificar atualizações disponíveis`, 
          type: 'text' 
        });
      }
    }
    
    return { evidence, firmwareInfo, status };
  }
  
  // fallback...
}
```

## Benefícios

1. **Zero manutenção** - os dados vêm direto do FortiGuard
2. **Sempre atualizado** - se a Fortinet lançar 7.2.13, o sistema detecta automaticamente
3. **Preciso** - sem possibilidade de erro humano no mapa de versões
4. **Inteligente** - compara apenas dentro do mesmo branch

## Exemplo de Resultado

**Firewall com v7.2.10 instalado:**
- Versão do Firmware: `v7.2.10`
- Build: `1706`
- Status: `❌ Atualização disponível: v7.2.12`
- Severidade: **HIGH** (já configurada na regra fw-001)

