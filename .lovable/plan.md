

## Plano: Correções no PDF de Análise de Firewall

### Problemas Identificados

1. **Logo não está sendo exibido** - No `Dashboard.tsx`, não há código para carregar o logo em base64 antes de passá-lo ao `FirewallPDF`.

2. **Tabela "Resumo por Categoria" está na página 2** - Deve ficar na página 1, como no PDF de Domínios Externos.

3. **Repetição de cabeçalhos de tabela em quebras de página** - Atualmente, se a tabela quebrar entre páginas, os nomes das colunas não são repetidos.

---

### Alterações Técnicas

#### 1. Arquivo: `src/components/Dashboard.tsx`

**Carregar o logo em base64 antes de gerar o PDF** (igual ao ExternalDomainAnalysisReportPage):

```text
┌────────────────────────────────────────────────────────────────────┐
│ No handleExportPDF:                                                │
│                                                                    │
│ 1. Importar dinamicamente o logo: @/assets/logo-iscope.png        │
│ 2. Fazer fetch do arquivo                                         │
│ 3. Converter para base64 via FileReader                           │
│ 4. Passar logoBase64 ao FirewallPDF                               │
└────────────────────────────────────────────────────────────────────┘
```

---

#### 2. Arquivo: `src/components/pdf/FirewallPDF.tsx`

**Mover PDFCategorySummaryTable para a Página 1:**

```text
┌────────────────────────────────────────────────────────────────────┐
│ PÁGINA 1 - Sumário Executivo                                       │
├────────────────────────────────────────────────────────────────────┤
│ PDFHeader                                                          │
│                                                                    │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ Hero Section (Score + Stats + Device Info)                    │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                    │
│ PDFCategorySummaryTable (com wrap habilitado)                     │
│                                                                    │
│ PDFFooter                                                          │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ PÁGINA 2 - Problemas Encontrados (se houver)                       │
├────────────────────────────────────────────────────────────────────┤
│ PDFIssuesSummary                                                   │
│ PDFFooter                                                          │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ PÁGINA 3+ - Detalhamento por Categoria                             │
├────────────────────────────────────────────────────────────────────┤
│ Título: "Detalhamento por Categoria"                               │
│ Aviso de Segurança                                                 │
│ PDFCategorySection (para cada categoria)                           │
│ PDFFooter                                                          │
└────────────────────────────────────────────────────────────────────┘
```

**Remover `wrap={false}` da tabela para permitir quebra:**
- A tabela grande do Firewall (muitas categorias) poderá quebrar entre páginas.

---

#### 3. Arquivo: `src/components/pdf/sections/PDFCategorySummaryTable.tsx`

**Adicionar repetição de cabeçalho nas quebras de página:**

O `@react-pdf/renderer` suporta a prop `fixed` em elementos dentro de componentes com `wrap`. Para repetir o cabeçalho:

```text
┌────────────────────────────────────────────────────────────────────┐
│ Alterações:                                                        │
│                                                                    │
│ 1. Remover wrap={false} do container da tabela                     │
│                                                                    │
│ 2. Adicionar prop `fixed` ao headerRow:                            │
│    <View style={styles.headerRow} fixed>                           │
│                                                                    │
│ 3. Isso faz o cabeçalho ser repetido em cada página               │
│    quando a tabela quebra                                          │
└────────────────────────────────────────────────────────────────────┘
```

---

### Resumo das Mudanças

| Arquivo | Alteração |
|---------|-----------|
| `Dashboard.tsx` | Adicionar código para carregar logo como base64 e passar ao PDF |
| `FirewallPDF.tsx` | Mover tabela de categorias para Página 1; Página 2 apenas para Issues |
| `PDFCategorySummaryTable.tsx` | Remover `wrap={false}`, adicionar `fixed` ao headerRow |

---

### Resultado Esperado

1. **Logo visível no cabeçalho** - Igual ao PDF de Domínios Externos

2. **Página 1 completa**:
   - Header com logo
   - Score Gauge + Stats
   - Informações do Dispositivo
   - Tabela "Resumo por Categoria"

3. **Tabela com cabeçalhos repetidos** - Se a tabela quebrar entre páginas, os nomes das colunas (Categoria, Taxa, Aprovadas, Falhas) aparecerão novamente no topo da nova página

