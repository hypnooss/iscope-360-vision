
# Alterações na Tabela de Compliance — Domínio Externo

## Arquivo alvo
`src/pages/external-domain/ExternalDomainReportsPage.tsx`

## Mudanças necessárias

### 1. Cabeçalho da tabela (linhas 568–574)

| Coluna atual | Mudança |
|---|---|
| `Cliente` | Renomear para `Workspace` |
| `Último Score` | Manter |
| `Status Execução` | **Remover** |
| `Data` | Renomear para `Última Execução` |
| + nova coluna | Adicionar `Frequência` (antes de `Último Score`) |

Novo cabeçalho:
```tsx
<TableHead>Domínio</TableHead>
<TableHead>Workspace</TableHead>
<TableHead>Frequência</TableHead>
<TableHead>Último Score</TableHead>
<TableHead>Última Execução</TableHead>
<TableHead className="text-right">Ações</TableHead>
```

---

### 2. Dados da coluna "Frequência"

A frequência vem da tabela `external_domain_schedules`. O campo `group.agent_id` já existe no `GroupedDomain`, mas `schedule_frequency` não está sendo buscado.

**Estratégia:** Buscar `external_domain_schedules` junto com os domínios no `fetchReports`, adicionar o campo `schedule_frequency` ao `domainsMeta`, e propagá-lo para o `GroupedDomain`.

Mudanças no `fetchReports`:
- Adicionar query em `external_domain_schedules` filtrando pelos `domainIds`
- Montar um mapa `scheduleMap` para cruzar com cada domínio
- Incluir `schedule_frequency` no objeto de `domainsMeta`

Mudanças nas interfaces:
```ts
// domainsMeta state type
{ ..., schedule_frequency: string }

// GroupedDomain interface
agent_id: string | null;
schedule_frequency: string; // novo campo
```

Labels de frequência (reutilizando o padrão de `ExternalDomainListPage`):
```ts
const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  manual: 'Manual',
};
```

---

### 3. Coluna "Status Execução" — remover

Remover o `<TableHead>` e o `<TableCell>` com `renderStatusBadge(currentAnalysis)`.

---

### 4. Coluna "Última Execução" (renomeada de "Data")

A lógica já existe — o `<Select>` com as datas de análise permanece idêntico, só o header muda.

---

### 5. Botão de download PDF na coluna Ações

Adicionar botão de download ao lado do botão de visualização. O botão só aparece quando `currentAnalysis?.status === 'completed'` (mesmo critério do botão de visualizar).

O fluxo será:
1. Buscar `report_data` via `fetchReportData(analysis.id)` (já existe)
2. Buscar logo como base64 (padrão do `ExternalDomainAnalysisReportPage`)
3. Buscar `categoryConfigs` e `correctionGuides` (já carregados no report page — aqui simplificamos: gerar o PDF sem eles ou fazer fetch simples)
4. Chamar `downloadPDF(<ExternalDomainPDF ... />, filename)`

**Para simplificar**, o download na tabela usará apenas os dados disponíveis (sem `categoryConfigs` e `correctionGuides` extras que são carregados dinamicamente). O PDF será gerado com `correctionGuides={[]}` e sem configs adicionais, assim como o botão de download da tela de relatório faz ao ter todos esses dados pré-carregados.

Imports a adicionar:
```ts
import { Download } from 'lucide-react';
import { usePDFDownload, sanitizePDFFilename, getPDFDateString } from '@/hooks/usePDFDownload';
import { ExternalDomainPDF } from '@/components/pdf/ExternalDomainPDF';
```

Estado adicional:
```ts
const [downloadingId, setDownloadingId] = useState<string | null>(null);
const { downloadPDF } = usePDFDownload();
```

Botão na coluna Ações:
```tsx
{currentAnalysis?.status === 'completed' && (
  <Button
    variant="ghost"
    size="icon"
    onClick={() => handleDownloadPDF(group)}
    disabled={downloadingId === currentAnalysis?.id}
    title="Baixar PDF"
  >
    {downloadingId === currentAnalysis?.id
      ? <Loader2 className="w-4 h-4 animate-spin" />
      : <Download className="w-4 h-4" />
    }
  </Button>
)}
```

---

## Arquivos modificados

1. `src/pages/external-domain/ExternalDomainReportsPage.tsx`
