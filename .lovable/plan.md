

# Usar Nome do Arquivo como Titulo da Documentacao API

## Problema

A funcao `buildDescriptiveTitle` tenta extrair informacoes do `basePath` do Swagger, mas isso gera titulos genericos e duplicados. Os arquivos JSON do FortiOS ja vem com nomes descritivos que identificam o conteudo.

## Solucao

Alterar a funcao `buildDescriptiveTitle` em `src/components/admin/ApiDocsManagement.tsx` para priorizar o nome do arquivo como titulo.

### Logica

1. Pegar o nome do arquivo (ex: `monitor_webfilter.json`)
2. Remover a extensao `.json`
3. Substituir underscores e hifens por espacos
4. Capitalizar as palavras para gerar um titulo legivel
5. Manter fallback para `basePath` e `info.title` caso o nome do arquivo nao seja descritivo

### Exemplo de resultado

| Nome do arquivo | Titulo gerado |
|---|---|
| `monitor_webfilter.json` | Monitor Webfilter |
| `cmdb_firewall_policy.json` | Cmdb Firewall Policy |
| `log_disk_traffic.json` | Log Disk Traffic |

### Alteracao tecnica

**Arquivo:** `src/components/admin/ApiDocsManagement.tsx`

Reescrever `buildDescriptiveTitle` (linhas 57-70):

```typescript
function buildDescriptiveTitle(content: any, fileName: string): string {
  // Priorizar o nome do arquivo, que no FortiOS ja e descritivo
  const nameWithoutExt = fileName.replace(/\.json$/i, '');
  if (nameWithoutExt) {
    // Substituir _ e - por espacos e capitalizar cada palavra
    const formatted = nameWithoutExt
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return formatted;
  }
  // Fallback
  return content?.info?.title || fileName;
}
```

Uma unica funcao alterada, sem outras mudancas no componente.

