

# Centralizar cards e renomear título na página "Novo Item"

## Mudanças em `src/pages/AddAssetPage.tsx`

1. **Título**: Alterar de "Adicionar Novo Item" para "Novo Item"
2. **Centralização**: Envolver o conteúdo (título + cards) em um container flex centralizado horizontal e verticalmente, ocupando o espaço disponível da página

### Detalhes técnicos

- Usar `flex flex-col items-center justify-center min-h-[calc(100vh-200px)]` no container principal para centralizar verticalmente (descontando header/breadcrumb)
- Manter o breadcrumb no topo (fora do container centralizado)
- Centralizar o bloco de título + botão voltar junto com os cards
- Alterar o texto `h1` de "Adicionar Novo Item" para "Novo Item"

