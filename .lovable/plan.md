

# Detalhamento Tabular de Itens Afetados com Exportacao CSV e PDF

## Objetivo
Transformar o dialog de itens afetados de uma lista de cards para uma visao tabular profissional, com colunas estruturadas e opcoes de exportacao em CSV e PDF, seguindo os padroes visuais do sistema.

## Mudancas

### 1. Reescrever `M365AffectedEntitiesDialog.tsx`
Substituir a lista de cards por uma tabela usando os componentes `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` ja existentes no projeto.

**Colunas da tabela:**
- Nome (displayName)
- Identificador (userPrincipalName ou email)
- Detalhes (colunas dinamicas extraidas de `entity.details`)

**Adicoes:**
- Botao "Exportar CSV" no header do dialog
- Botao "Exportar PDF" no header do dialog (usando `usePDFDownload`)
- Mensagem de "e mais X entidades" quando `affectedCount > affectedEntities.length`
- Dialog ampliado para `max-w-4xl` para acomodar a tabela

### 2. Criar `M365AffectedEntitiesPDF.tsx`
Novo componente PDF usando `@react-pdf/renderer` seguindo o design system existente (`pdfStyles.ts`):
- Cabecalho com codigo do insight, severidade e titulo
- Tabela com as mesmas colunas da versao web
- Rodape padrao do sistema (`PDFFooter`)
- Usa `colors`, `typography`, `spacing` do design system

### 3. Exportar novo componente
Atualizar `src/components/pdf/index.ts` para exportar o novo PDF.

## Detalhes Tecnicos

### Logica de Colunas Dinamicas
Os `details` de cada entidade podem variar por insight (ex: `state`, `created`, `lastSignIn`). O sistema detectara automaticamente todas as chaves unicas presentes nas entidades e criara colunas dinamicas:

```typescript
const detailKeys = useMemo(() => {
  const keys = new Set<string>();
  insight.affectedEntities.forEach(e => {
    if (e.details) Object.keys(e.details).forEach(k => keys.add(k));
  });
  return Array.from(keys);
}, [insight.affectedEntities]);
```

### Exportacao CSV
Funcao utilitaria que gera um arquivo CSV com BOM UTF-8 para compatibilidade com Excel:

```typescript
function exportCSV(insight: M365Insight, detailKeys: string[]) {
  const headers = ['Nome', 'Identificador', ...detailKeys];
  const rows = insight.affectedEntities.map(e => [
    e.displayName,
    e.userPrincipalName || e.email || '',
    ...detailKeys.map(k => String(e.details?.[k] ?? ''))
  ]);
  // Gera blob com BOM e dispara download
}
```

### PDF
Usa `usePDFDownload` (hook ja existente) para gerar o PDF a partir do componente `M365AffectedEntitiesPDF`, seguindo o padrao de cores e tipografia de `pdfStyles.ts`.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/m365/posture/M365AffectedEntitiesDialog.tsx` | Reescrever com tabela + botoes de exportacao |
| `src/components/pdf/M365AffectedEntitiesPDF.tsx` | Criar componente PDF para entidades afetadas |
| `src/components/pdf/index.ts` | Adicionar exportacao do novo componente |
