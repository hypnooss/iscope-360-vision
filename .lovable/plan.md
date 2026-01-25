
# Padronização do Espaçamento das Páginas Administrativas

## Problema Identificado
As páginas **Coletas** e **Tarefas** usam `p-6 space-y-6`, enquanto a página **Administradores** usa `p-6 lg:p-8 space-y-6`. Isso causa uma diferença visual em telas maiores (≥1024px).

## Alterações Necessárias

| Arquivo | Linha | Atual | Novo |
|---------|-------|-------|------|
| `src/pages/admin/CollectionsPage.tsx` | 268 | `space-y-6 p-6` | `p-6 lg:p-8 space-y-6` |
| `src/pages/admin/TasksPage.tsx` | 321 | `space-y-6 p-6` | `p-6 lg:p-8 space-y-6` |

## Resultado
Todas as páginas administrativas terão:
- **24px** de padding em telas normais (`p-6`)
- **32px** de padding em telas grandes (`lg:p-8`)
- **24px** de espaçamento vertical entre elementos (`space-y-6`)
