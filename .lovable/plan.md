

## Ordenação com persistência na tabela de Agents

**Arquivo:** `src/pages/AgentsPage.tsx`

### Alterações

1. **Importar ícones** `ArrowUp`, `ArrowDown`, `ChevronsUpDown` do lucide-react
2. **Criar componente `SortableHead`** interno (mesmo padrão do `AssetCategorySection`)
3. **Adicionar estado** `sortKey` e `sortDir` com inicialização via `localStorage` (chave `agents-sort`)
4. **Função `handleSort`** com ciclo 3 estados + persistência em `localStorage`
5. **`sortedItems` com `useMemo`** aplicado sobre `filtered`, ordenando por:
   - **Nome** (`name`): string localeCompare
   - **Cliente** (`client_name`): string localeCompare
   - **Versão** (`agent_version`): string localeCompare
   - **Status**: comparação pelo label gerado por `getAgentStatus`
   - **Last Seen** (`last_seen`): comparação de datas (null vai pro final)
6. **Substituir `<TableHead>`** por `<SortableHead>` nas 5 colunas (exceto Ações)
7. **Renderizar `sortedItems`** no lugar de `filtered` no `TableBody`

Mesmo padrão visual e de comportamento já implementado no `AssetCategorySection`.

