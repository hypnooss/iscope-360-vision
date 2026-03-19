

## Adicionar ordenação persistente na tabela de Usuários

Aplicar o mesmo padrão de ordenação 3-state com persistência via localStorage na tabela da página `UsersPage.tsx`.

### Implementação — `src/pages/UsersPage.tsx`

**1. Imports adicionais:** `ArrowUp`, `ArrowDown`, `ChevronsUpDown` do lucide-react.

**2. Componente `SortableHead` local** (mesmo padrão já usado em `AssetCategorySection` e `LicensingHubPage`).

**3. Hook `usePersistentSort`** com localStorage key `users-sort`.

**4. `useMemo` para `sortedUsers`** aplicado sobre `filteredUsers`.

**5. Colunas ordenáveis:**

| Coluna | Chave | Tipo |
|---|---|---|
| Usuário | `full_name` | string |
| Role | `role` | string |
| Módulos | `moduleCount` (derivado) | número |
| Clientes | `clientCount` (derivado) | número |
| Cadastro | `created_at` | data |

A coluna "Ações" permanece sem sort.

**6. Lógica de comparação:**
- Strings: `localeCompare('pt-BR')`
- Números (moduleCount, clientCount): comparação numérica
- Data (`created_at`): comparação por timestamp
- Nulls empurrados para o final

**7. Substituir `<TableHead>` por `<SortableHead>`** no header e renderizar `sortedUsers` no body.

