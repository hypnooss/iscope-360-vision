

## Conectar "Exportar PDF" nos dropdowns de Compliance

### 1. ExternalDomainCompliancePage.tsx (linha 561)

Substituir o `toast.info` placeholder por chamada ao `handleExportPDF` que ja existe na linha 464. Desabilitar se `!report` ou `isExportingPDF`.

```
<DropdownMenuItem onClick={handleExportPDF} disabled={!report || isExportingPDF}>
  {isExportingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
  Exportar PDF
</DropdownMenuItem>
```

### 2. FirewallCompliancePage.tsx (linhas 358-360)

- Importar `FirewallPDF` de `@/components/pdf/FirewallPDF`, `usePDFDownload`, `sanitizePDFFilename`, `getPDFDateString`
- Adicionar `const { downloadPDF, isGenerating: isExportingPDF } = usePDFDownload();`
- Criar funcao `handleExportPDF` que monta `<FirewallPDF>` com `report`, `deviceInfo` (name, url, vendor, clientName), `categoryConfigs` e logo base64
- Substituir o placeholder toast no dropdown pelo `handleExportPDF`

