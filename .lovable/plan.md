

## Plan: Ajustar cards de permissões - menor altura, maior largura, 3 colunas

### Ambos os arquivos: `AddM365TenantPage.tsx` e `M365TenantEditPage.tsx`

1. **Grid de 3 colunas fixas** — Alterar `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` para `grid-cols-1 md:grid-cols-3` em todos os grids de permissões (Graph e RBAC).

2. **Cards mais largos e menos altos** — Alterar o padding dos cards de `p-3` para `py-2 px-3` e mudar `space-y-1` para layout inline: colocar nome e descrição na mesma linha usando `flex items-center gap-2` com a descrição ao lado do nome separada por um `—` ou exibir descrição em linha abaixo com menos padding (`pl-5 mt-0.5`).

**Arquivos afetados:**
- `src/pages/environment/AddM365TenantPage.tsx` (linhas 432, 434, 449, 451)
- `src/pages/environment/M365TenantEditPage.tsx` (linhas 259, 263, 280, 284)

