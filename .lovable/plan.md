
# Titulos Descritivos para Documentacao API

## Problema

Todos os documentos API do FortiOS ficam com o mesmo titulo generico (ex: "FortiOS API") porque o campo `info.title` do Swagger e igual em todos os arquivos. O titulo deveria refletir o conteudo real, como "FortiOS Monitor webfilter".

## Solucao

**Arquivo:** `src/components/admin/ApiDocsManagement.tsx`

Alterar a logica de deteccao de titulo (linha 170) para construir um nome mais descritivo a partir do `basePath` do Swagger. Por exemplo:

- `basePath: "/api/v2/monitor/webfilter"` gera o titulo **"FortiOS Monitor webfilter"**
- `basePath: "/api/v2/cmdb/firewall"` gera o titulo **"FortiOS REST firewall"**
- `basePath: "/api/v2/log/disk"` gera o titulo **"FortiOS Log disk"**

### Logica tecnica

```typescript
function buildDescriptiveTitle(content: any, fileName: string): string {
  const basePath = content?.basePath || '';
  // Extrair categoria e subcategoria do basePath
  // Ex: "/api/v2/monitor/webfilter" -> ["monitor", "webfilter"]
  const parts = basePath.replace(/^\/api\/v\d+\//, '').split('/').filter(Boolean);
  
  if (parts.length >= 2) {
    // "FortiOS Monitor webfilter"
    const category = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const subcategory = parts.slice(1).join(' ');
    return `FortiOS ${category} ${subcategory}`;
  }
  if (parts.length === 1) {
    const category = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return `FortiOS ${category}`;
  }
  // Fallback: info.title ou nome do arquivo
  return content?.info?.title || fileName.replace('.json', '');
}
```

Substituir a linha 170:
```typescript
// De:
const detectedTitle = parsed?.info?.title || file.name.replace('.json', '');
// Para:
const detectedTitle = buildDescriptiveTitle(parsed, file.name);
```

O titulo tambem sera editavel na lista de preview antes do envio, caso o usuario queira ajustar manualmente.
