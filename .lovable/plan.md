

## Adicionar ordenação persistente nas 4 abas de Gestão de Ativos

Aplicar o mesmo padrão de ordenação 3-state (sem ordem → crescente → decrescente) com persistência via localStorage que já existe em `AssetCategorySection.tsx` nas 4 tabelas de `LicensingHubPage.tsx`.

### Abordagem

Reutilizar o componente `SortableHead` já existente (ou criar um local idêntico) dentro de `LicensingHubPage.tsx`, com estado de sort separado por aba e persistido em localStorage.

### Implementação — `src/pages/LicensingHubPage.tsx`

**1. Adicionar imports**: `ArrowUp`, `ArrowDown`, `ChevronsUpDown` do lucide-react.

**2. Criar componente `SortableHead` local** (mesmo padrão do `AssetCategorySection`).

**3. Para cada aba, adicionar:**
- State: `sortKey` + `sortDir` com localStorage key único por aba (`licensing-sort-firewalls`, `licensing-sort-tls`, `licensing-sort-domains`, `licensing-sort-m365`)
- Handler `handleSort` com ciclo: null → asc → desc → null
- `useMemo` para ordenar os dados filtrados

**4. Colunas ordenáveis por aba:**

| Aba | Colunas ordenáveis |
|---|---|
| Firewalls | Firewall (nome), Modelo, Workspace, FortiCare (daysLeft) |
| TLS | IP/Porta, Subject CN, Issuer, Expiração (daysLeft) |
| Domínios | Domínio, Workspace, Registrar, Expiração (daysLeft) |
| M365 | Tenant, Licença, Status, Total, Em uso, Vencimento (daysLeft) |

**5. Lógica de comparação:**
- Strings: `localeCompare('pt-BR', { sensitivity: 'base' })`
- Números (score, daysLeft, totalUnits, consumedUnits): null values pushed to end
- A coluna "Ações" não terá sort (mantém `TableHead` simples)

**6. Substituir `TableHead` por `SortableHead`** em cada header de tabela, mantendo o visual idêntico ao screenshot (ícones `↑`, `↓`, `⇅`).

### Resultado
Todas as 4 tabelas terão headers clicáveis com indicador visual do estado de ordenação, persistindo a escolha do usuário entre navegações.

