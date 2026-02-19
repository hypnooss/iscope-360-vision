
# Ajustes na Página de Insights do Analyzer

## O que será feito

Quatro mudanças na página `src/pages/firewall/AnalyzerInsightsPage.tsx`:

1. **Breadcrumb** — Corrigir o path. O primeiro item atualmente aponta para `/scope-firewall/reports` com label "Compliance". De acordo com o padrão do sistema e o que está na imagem, o correto é: `Firewall` (não clicável, cursor-default) → `Analyzer` (link para `/scope-firewall/analyzer`) → `Insights` (ativo atual). O componente `PageBreadcrumb` já trata o último item como a "página atual" com badge destacado.

2. **Título e subtítulo com botão Voltar** — Adicionar um botão `<ArrowLeft>` ao lado esquerdo do título `Insights`, que ao ser clicado navega de volta para `/scope-firewall/analyzer`. Padrão: ícone `ArrowLeft` da lucide-react, clicável, com `cursor-pointer` e `hover:text-primary`.

3. **Remover o seletor de Severidade** — O `<Select>` com `severityFilter` (o que tem o ícone `<Filter>` e opções "Todas / Critical / High...") deve ser removido tanto da UI quanto a lógica de estado `severityFilter`. O filtro de categoria permanece.

4. **Adicionar seletor de Workspace** — Seguindo exatamente o padrão do `AnalyzerDashboardPage.tsx`:
   - Importar `useEffectiveAuth` para detectar `isSuperRole`
   - Importar `usePreview` para detectar `isPreviewMode`
   - Importar `useWorkspaceSelector` e `Building2` (lucide)
   - Adicionar query `clients-list` para carregar os workspaces disponíveis
   - Exibir o seletor de Workspace **à esquerda** do seletor de Firewall (visível apenas para `isSuperRole && !isPreviewMode`)
   - Filtrar os firewalls pelo `selectedWorkspaceId` (mesmo padrão do Dashboard do Analyzer)
   - Ao mudar o workspace, limpar o firewall selecionado e recarregar a lista

## Ordem dos seletores (da esquerda para direita)

```text
[ Workspace (super roles only) ]  [ Firewall ]  [ Todas categorias ]
```

## Detalhes técnicos

### Estados e imports a adicionar
```tsx
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { usePreview } from '@/contexts/PreviewContext';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
```

### Estado `severityFilter` a remover
- `const [severityFilter, setSeverityFilter] = useState<string>('all');`
- Lógica de filtro em `filteredInsights` referenciando `severityFilter`
- O `<Select>` do severity na UI

### Breadcrumb corrigido
```tsx
<PageBreadcrumb items={[
  { label: 'Firewall' },                               // não clicável (sem href)
  { label: 'Analyzer', href: '/scope-firewall/analyzer' }, // link
  { label: 'Insights' },                               // ativo (último)
]} />
```

### Título com botão voltar
```tsx
<div className="flex items-center gap-3">
  <Button variant="ghost" size="icon" onClick={() => navigate('/scope-firewall/analyzer')}>
    <ArrowLeft className="w-5 h-5" />
  </Button>
  <div>
    <h1 className="text-2xl font-bold text-foreground">Insights</h1>
    <p className="text-muted-foreground">Drill-down técnico por categoria</p>
  </div>
</div>
```

## Arquivo modificado
- `src/pages/firewall/AnalyzerInsightsPage.tsx`
