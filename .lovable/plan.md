

# Plano: Melhorias nas Evidências de Firmware + Correção do Exportar PDF

## Resumo das Solicitações

1. **Melhorar exibição de evidências de "Versão do Firmware" (fw-001)**
2. **Corrigir botão "Exportar PDF"** para ter layout similar à versão web

---

## Parte 1: Implementar Formatador de Firmware (fw-001)

O formatador `formatFirmwareEvidence` ainda não foi implementado na Edge Function. Esta é a causa raiz do dropdown não funcionar corretamente.

### 1.1 Adicionar função `formatFirmwareEvidence` na Edge Function

```typescript
function formatFirmwareEvidence(
  rawData: Record<string, unknown>
): { evidence: EvidenceItem[], firmwareInfo: Record<string, unknown>, status: 'pass' | 'fail' | 'warn' } {
  const evidence: EvidenceItem[] = [];
  const firmwareInfo: Record<string, unknown> = {};
  
  try {
    const systemStatus = rawData['system_status'] as Record<string, unknown> | undefined;
    
    if (!systemStatus) {
      evidence.push({ label: 'Status', value: 'Dados não disponíveis', type: 'text' });
      return { evidence, firmwareInfo, status: 'warn' };
    }
    
    // Extrair versão do nível raiz (não de results!)
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
    
    if (version) {
      const cleanVersion = version.replace(/^v/i, '');
      
      evidence.push({ label: 'Versão do Firmware', value: version, type: 'code' });
      if (build) evidence.push({ label: 'Build', value: String(build), type: 'text' });
      if (model) evidence.push({ label: 'Modelo', value: String(model), type: 'text' });
      if (hostname) evidence.push({ label: 'Hostname', value: String(hostname), type: 'text' });
      if (serial) evidence.push({ label: 'Serial', value: serial, type: 'code' });
      
      // Avaliar versão
      const majorMinor = cleanVersion.match(/^(\d+)\.(\d+)/);
      let status: 'pass' | 'fail' | 'warn' = 'warn';
      
      if (majorMinor) {
        const major = parseInt(majorMinor[1]);
        const minor = parseInt(majorMinor[2]);
        
        if (major >= 7 && minor >= 2) {
          status = 'pass';
          evidence.push({ label: 'Avaliação', value: '✅ Versão atual e suportada', type: 'text' });
        } else if (major >= 7) {
          status = 'warn';
          evidence.push({ label: 'Avaliação', value: '⚠️ Considerar atualização', type: 'text' });
        } else {
          status = 'fail';
          evidence.push({ label: 'Avaliação', value: '❌ Versão desatualizada', type: 'text' });
        }
      }
      
      return { evidence, firmwareInfo, status };
    } else {
      evidence.push({ label: 'Status', value: '⚠️ Versão não identificada', type: 'text' });
      return { evidence, firmwareInfo, status: 'warn' };
    }
  } catch (e) {
    console.error('Error formatting firmware evidence:', e);
    evidence.push({ label: 'Erro', value: 'Falha ao processar', type: 'text' });
    return { evidence, firmwareInfo, status: 'warn' };
  }
}
```

### 1.2 Integrar no processamento de regras

Adicionar tratamento específico para `fw-001` no switch de regras da função `processComplianceRules`.

---

## Parte 2: Correção do Exportar PDF

O PDF atual usa `jsPDF` com `autoTable` para gerar tabelas simples. Para se aproximar do layout web, precisamos:

### 2.1 Melhorias no Header do PDF

| Atual | Proposto |
|-------|----------|
| Título "FortiGate Compliance Report" | Título dinâmico: "Relatório de Compliance - [Nome do Firewall]" |
| Sem info do dispositivo | Incluir bloco com: Nome, URL, Modelo, Serial, Firmware, Uptime |

### 2.2 Melhorias no Score Visual

| Atual | Proposto |
|-------|----------|
| Círculo simples com % | Manter círculo + adicionar rótulo de risco (EXCELENTE, BOM, etc) - já implementado |

### 2.3 Melhorias nas Categorias

| Atual | Proposto |
|-------|----------|
| Tabela simples com Status/Verificação/Severidade/Detalhes | Adicionar **Evidências** nas linhas quando disponíveis |

### 2.4 Alterações no `pdfExport.ts`

#### 2.4.1 Adicionar parâmetros de dispositivo

```typescript
export function exportReportToPDF(
  report: ComplianceReport,
  deviceInfo?: {
    name?: string;
    url?: string;
    vendor?: string;
  }
) {
  // ... usar deviceInfo no header
}
```

#### 2.4.2 Adicionar bloco de informações do dispositivo (após header)

```typescript
// Device Info Block
if (deviceInfo?.name || report.systemInfo?.hostname) {
  yPos += 10;
  doc.setFillColor(245, 248, 255);
  doc.roundedRect(14, yPos - 3, pageWidth - 28, 28, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  
  // Nome do dispositivo
  doc.text(`Dispositivo: ${deviceInfo?.name || report.systemInfo?.hostname || 'N/A'}`, 20, yPos + 5);
  
  // Modelo e Serial na mesma linha
  const modelSerial = `Modelo: ${report.systemInfo?.model || 'N/A'} | Serial: ${report.systemInfo?.serial || 'N/A'}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(modelSerial, 20, yPos + 12);
  
  // Firmware e Uptime
  const fwUptime = `Firmware: ${report.firmwareVersion || 'N/A'} | Uptime: ${report.systemInfo?.uptime || 'N/A'}`;
  doc.text(fwUptime, 20, yPos + 19);
  
  yPos += 32;
}
```

#### 2.4.3 Incluir evidências nas tabelas de categorias

Para cada categoria, ao invés de apenas mostrar "Detalhes" truncado, expandir para mostrar evidências quando relevantes:

```typescript
const checksData = category.checks.map(check => {
  let detailsText = check.details || '-';
  
  // Incluir resumo das evidências quando disponíveis
  if (check.evidence && check.evidence.length > 0) {
    const evidenceSummary = check.evidence
      .slice(0, 3) // Máximo 3 itens
      .map(e => `${e.label}: ${e.value}`)
      .join(' | ');
    
    if (evidenceSummary.length > 0 && evidenceSummary.length < 200) {
      detailsText = evidenceSummary;
    }
  }
  
  return [
    getStatusText(check.status),
    check.name,
    getSeverityText(check.severity),
    sanitizeForPDF(detailsText).substring(0, 100) + (detailsText.length > 100 ? '...' : '')
  ];
});
```

#### 2.4.4 Atualizar Dashboard.tsx para passar deviceInfo

```typescript
const handleExportPDF = () => {
  try {
    const reportWithCVEs = { ...report, cves: loadedCVEs };
    exportReportToPDF(reportWithCVEs, {
      name: firewallName,
      url: firewallUrl,
      vendor: deviceVendor
    });
    toast.success('PDF exportado com sucesso!');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    toast.error('Erro ao exportar PDF');
  }
};
```

---

## Arquivos a Modificar

1. **`supabase/functions/agent-task-result/index.ts`**
   - Adicionar função `formatFirmwareEvidence`
   - Integrar no processamento de `fw-001`
   - Declarar variável `fwResult`
   - Adicionar tratamento de rawData para `fw-001`

2. **`src/utils/pdfExport.ts`**
   - Atualizar assinatura para aceitar `deviceInfo`
   - Adicionar bloco de informações do dispositivo
   - Melhorar exibição de evidências nas tabelas
   - Ajustar título dinâmico

3. **`src/components/Dashboard.tsx`**
   - Passar `deviceInfo` para `exportReportToPDF`

---

## Layout Comparativo

### Web (atual)

```text
┌─────────────────────────────────────────────────────────────┐
│  Análise de Compliance                    [PDF] [Reanalisar]│
│  Gerado em: 26/01/2026 ...                                  │
├──────────────┬──────────────────────────────────────────────┤
│   SCORE      │  ┌ ShieldCheck ┐  Nome: SAO-FW              │
│    55%       │  │  FortiGate  │  FortiOS: v7.2.10          │
│   ATENÇÃO    │  └─────────────┘  URL: https://...          │
│              │                   Modelo: FGT40F             │
│              │                   Serial: FGT40FTK...        │
│              │                   Uptime: 2d 5h 30m          │
│              ├──────────────────────────────────────────────┤
│              │  Verificações: 45  ✓32  ✗8  ⚠5               │
└──────────────┴──────────────────────────────────────────────┘
```

### PDF (proposto)

```text
┌─────────────────────────────────────────────────────────────┐
│         Relatório de Compliance - SAO-FW                    │
│         Gerado em: 26/01/2026 02:54:38                      │
├──────────────────────────────────────────────────────────────
│ Dispositivo: SAO-FW                                         │
│ Modelo: FGT40F | Serial: FGT40FTK21045571                   │
│ Firmware: v7.2.10 | Uptime: 2d 5h 30m                       │
├─────────────┬─────────────────┬─────────────────────────────┤
│  COMPLIANCE │  EXPOSIÇÃO AO   │  COBERTURA UTM              │
│    GERAL    │     RISCO       │                             │
│     55%     │  ● 2 Críticos   │  ● 3/5 UTM Completo         │
│   ATENÇÃO   │  ● 3 Altos      │  ● 1/5 UTM Parcial          │
│             │  ● 3 Médios     │  ● 1/5 Sem UTM              │
└─────────────┴─────────────────┴─────────────────────────────┘
```

---

## Complexidade

Média - Implementação de formatador pendente + melhorias estruturais no PDF

