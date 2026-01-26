
# Plano: Otimização das Evidências de Firmware (fw-001)

## Problema Identificado

O formatador de evidências de firmware (`fw-001`) está exibindo informações redundantes que já aparecem no topo da página:
- **Modelo** - já exibido no card superior
- **Hostname** - já exibido no card superior  
- **Serial** - já exibido no card superior
- **Avaliação** - texto genérico "Versão atual e suportada"

Além disso, a lógica de avaliação atual é imprecisa:
- Considera "pass" se versão >= 7.2
- Não compara com a última versão mature disponível
- Não alerta adequadamente quando há atualização disponível

## Solução Proposta

### Parte 1: Simplificar Evidências

Remover as evidências redundantes, mantendo apenas:
- **Versão do Firmware** - ex: `v7.2.10`
- **Build** - ex: `1706`

### Parte 2: Melhorar Lógica de Avaliação

Implementar verificação contra versões conhecidas mature da Fortinet:
- Manter um mapa de versões mature por major.minor
- Comparar a versão instalada com a última mature disponível
- Se não for a última mature, retornar `fail` com severidade HIGH

**Versões Mature Conhecidas (Jan 2025):**
- 7.4.x -> 7.4.6 (latest mature)
- 7.2.x -> 7.2.10 (latest mature)
- 7.0.x -> 7.0.16 (latest mature)
- 6.4.x -> 6.4.15 (latest mature - EoL soon)

## Alterações Necessárias

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

**Função:** `formatFirmwareEvidence` (linhas 785-855)

### Código Atual (linhas 816-843):
```typescript
if (version) {
  const cleanVersion = version.replace(/^v/i, '');
  
  evidence.push({ label: 'Versão do Firmware', value: version, type: 'code' });
  if (build) evidence.push({ label: 'Build', value: String(build), type: 'text' });
  if (model) evidence.push({ label: 'Modelo', value: String(model), type: 'text' });
  if (hostname) evidence.push({ label: 'Hostname', value: String(hostname), type: 'text' });
  if (serial) evidence.push({ label: 'Serial', value: serial, type: 'code' });
  
  // Evaluate version
  const majorMinor = cleanVersion.match(/^(\d+)\.(\d+)/);
  let status: 'pass' | 'fail' | 'warn' = 'warn';
  
  if (majorMinor) {
    const major = parseInt(majorMinor[1]);
    const minor = parseInt(majorMinor[2]);
    
    if (major >= 7 && minor >= 2) {
      status = 'pass';
      evidence.push({ label: 'Avaliação', value: 'Versão atual e suportada', type: 'text' });
    } else if (major >= 7) {
      status = 'warn';
      evidence.push({ label: 'Avaliação', value: 'Considerar atualização', type: 'text' });
    } else {
      status = 'fail';
      evidence.push({ label: 'Avaliação', value: 'Versão desatualizada', type: 'text' });
    }
  }
  
  return { evidence, firmwareInfo, status };
}
```

### Código Proposto:
```typescript
// Mapa de versões mature da Fortinet (atualizado Jan 2025)
const matureVersions: Record<string, { latest: string; eol?: boolean }> = {
  '7.6': { latest: '7.6.1' },
  '7.4': { latest: '7.4.6' },
  '7.2': { latest: '7.2.10' },
  '7.0': { latest: '7.0.16', eol: true },
  '6.4': { latest: '6.4.15', eol: true },
};

if (version) {
  const cleanVersion = version.replace(/^v/i, '');
  
  // Evidências simplificadas - apenas versão e build
  evidence.push({ label: 'Versão do Firmware', value: version, type: 'code' });
  if (build) evidence.push({ label: 'Build', value: String(build), type: 'text' });
  
  // Avaliar versão contra mature conhecida
  const versionParts = cleanVersion.match(/^(\d+)\.(\d+)\.?(\d+)?/);
  let status: 'pass' | 'fail' | 'warn' = 'warn';
  
  if (versionParts) {
    const major = parseInt(versionParts[1]);
    const minor = parseInt(versionParts[2]);
    const patch = parseInt(versionParts[3] || '0');
    const branchKey = `${major}.${minor}`;
    const fullVersion = `${major}.${minor}.${patch}`;
    
    const branchInfo = matureVersions[branchKey];
    
    if (branchInfo) {
      const latestParts = branchInfo.latest.match(/(\d+)\.(\d+)\.(\d+)/);
      if (latestParts) {
        const latestPatch = parseInt(latestParts[3]);
        
        if (patch >= latestPatch) {
          // Na última versão mature do branch
          if (branchInfo.eol) {
            status = 'warn';
            evidence.push({ 
              label: 'Status', 
              value: `⚠️ Branch ${branchKey} em fim de vida - Considerar migração`, 
              type: 'text' 
            });
          } else {
            status = 'pass';
            evidence.push({ 
              label: 'Status', 
              value: `✅ Última versão mature do branch ${branchKey}`, 
              type: 'text' 
            });
          }
        } else {
          // Não está na última mature
          status = 'fail';
          evidence.push({ 
            label: 'Status', 
            value: `❌ Atualização disponível: ${branchInfo.latest}`, 
            type: 'text' 
          });
          evidence.push({ 
            label: 'Versão Instalada', 
            value: fullVersion, 
            type: 'text' 
          });
          evidence.push({ 
            label: 'Última Mature', 
            value: branchInfo.latest, 
            type: 'text' 
          });
        }
      }
    } else if (major < 6 || (major === 6 && minor < 4)) {
      // Versão muito antiga
      status = 'fail';
      evidence.push({ 
        label: 'Status', 
        value: '❌ Versão obsoleta - Migração urgente necessária', 
        type: 'text' 
      });
    } else {
      // Branch desconhecido (possivelmente mais novo)
      status = 'warn';
      evidence.push({ 
        label: 'Status', 
        value: `⚠️ Branch ${branchKey} não catalogado`, 
        type: 'text' 
      });
    }
  }
  
  return { evidence, firmwareInfo, status };
}
```

## Exemplos de Resultado

| Versão Instalada | Última Mature | Status | Evidência |
|------------------|---------------|--------|-----------|
| v7.2.10 | 7.2.10 | ✅ pass | "Última versão mature do branch 7.2" |
| v7.2.8 | 7.2.10 | ❌ fail | "Atualização disponível: 7.2.10" |
| v7.4.4 | 7.4.6 | ❌ fail | "Atualização disponível: 7.4.6" |
| v7.0.16 | 7.0.16 | ⚠️ warn | "Branch 7.0 em fim de vida - Considerar migração" |
| v6.4.10 | 6.4.15 | ❌ fail | "Atualização disponível: 6.4.15" |

## Benefícios

1. **Evidências Limpas**: Apenas informações relevantes (versão e build)
2. **Avaliação Precisa**: Compara com a última mature disponível do branch
3. **Alertas HIGH**: Dispositivos desatualizados terão status `fail` (severidade HIGH já configurada na regra)
4. **Orientação Clara**: Mostra exatamente qual versão deve ser instalada

## Manutenção Futura

O mapa `matureVersions` deverá ser atualizado quando novas versões mature forem lançadas pela Fortinet (tipicamente a cada 2-3 meses).
