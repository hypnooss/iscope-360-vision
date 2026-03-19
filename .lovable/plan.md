

## Ordenação nas tabelas do Ambiente

Adicionar ordenação clicável nos cabeçalhos das tabelas do `AssetCategorySection`, com 3 estados cíclicos: sem ordenação → crescente → decrescente → sem ordenação.

### Alterações

**Arquivo:** `src/components/environment/AssetCategorySection.tsx`

1. Adicionar estado de ordenação (`sortKey` + `sortDirection`) com `useState`
2. Criar um componente interno `SortableHead` que:
   - Renderiza o texto do cabeçalho com `cursor-pointer`
   - Exibe ícone `ArrowUp`, `ArrowDown` ou `ChevronsUpDown` (neutro) conforme o estado
   - Ao clicar, cicla entre: `asc` → `desc` → `null` (sem ordenação)
3. Aplicar `useMemo` para ordenar os `items` antes de renderizar, usando comparação por string ou número conforme a coluna:
   - **Nome**: string (localeCompare)
   - **Agent**: string
   - **Workspace**: string
   - **Frequência**: string (daily/weekly/monthly)
   - **Score**: número (null vai para o final)
   - **Status**: string
4. Coluna "Ações" não será ordenável

### Comportamento
- Clique no header alterna: neutro → crescente → decrescente → neutro
- Ícone discreto (`w-3 h-3`, `text-muted-foreground`) ao lado do texto
- Quando ativo, ícone muda para `text-foreground` para indicar ordenação ativa
- Apenas uma coluna ordenada por vez

### Detalhes técnicos

```typescript
type SortKey = 'name' | 'agentName' | 'workspaceName' | 'scheduleFrequency' | 'score' | 'status';
type SortDir = 'asc' | 'desc' | null;

const [sortKey, setSortKey] = useState<SortKey | null>(null);
const [sortDir, setSortDir] = useState<SortDir>(null);

const handleSort = (key: SortKey) => {
  if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
  else if (sortDir === 'asc') setSortDir('desc');
  else if (sortDir === 'desc') { setSortKey(null); setSortDir(null); }
};
```

Nenhum outro arquivo precisa ser alterado — a lógica fica inteiramente dentro do `AssetCategorySection`.

