
# Alinhar colunas das tabelas de ativos

## Problema
As colunas "Nome", "Agent", "Workspace", "Score", "Status" e "Acoes" nao estao alinhadas entre as 3 tabelas porque o conteudo de cada uma tem tamanhos diferentes, fazendo o navegador calcular larguras distintas.

## Solucao
Adicionar larguras fixas (via classes Tailwind `w-[]`) nos `TableHead` e `TableCell` do componente `AssetCategorySection.tsx`, garantindo que todas as tabelas usem a mesma distribuicao de colunas.

### Arquivo: `src/components/environment/AssetCategorySection.tsx`

Aplicar as seguintes larguras nas colunas:

| Coluna | Largura |
|--------|---------|
| Nome | w-[25%] |
| Agent | w-[18%] |
| Workspace | w-[22%] |
| Score | w-[12%] |
| Status | w-[12%] |
| Acoes | w-[11%] text-right |

Isso sera aplicado tanto nos `TableHead` quanto nos `TableCell` correspondentes, forcando alinhamento identico entre as 3 tabelas independentemente do conteudo.
