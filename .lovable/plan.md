
# Plano: Redirecionar Card "Alterações de Config" para Página Dedicada

## Situação Atual
- O card "Alterações de Config" abre o Sheet genérico (`AnalyzerCategorySheet`) que mostra "Nenhum detalhe disponível" 
- Já existe uma página completa para visualização de config changes: `/scope-firewall/analyzer/config-changes` (`AnalyzerConfigChangesPage.tsx`) com ~1000 linhas de formatadores especializados

## Solução
Interceptar o clique na categoria `config_changes` e redirecionar para a página existente em vez de abrir o Sheet.

## Mudança

### `src/pages/firewall/AnalyzerDashboardV2Page.tsx`

Modificar o handler `onCategoryClick`:

```tsx
import { useNavigate } from 'react-router-dom';

// No componente:
const navigate = useNavigate();

// No handler:
onCategoryClick={(category) => {
  if (category === 'config_changes') {
    navigate('/scope-firewall/analyzer/config-changes');
    return;
  }
  setSelectedCategory(category);
  setCategorySheetOpen(true);
}}
```

## Arquivos Modificados
- `src/pages/firewall/AnalyzerDashboardV2Page.tsx`
