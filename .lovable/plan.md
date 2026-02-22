
# Ajustes na aba Resumo do AssetDetailSheet

## Alteracoes

**Arquivo**: `src/components/surface/AssetDetailSheet.tsx`

1. **Renomear aba "Resumo" para "Analise"**: Alterar o texto do TabsTrigger e o valor do defaultValue de `resumo` para `analise`
2. **Remover os 4 mini stat cards**: Remover o bloco do grid 2x2 com MiniStat (linhas 345-351) -- as informacoes de portas, servicos, CVEs e certificados ja estao visiveis nos badges do header e nas abas dedicadas
3. **Remover o titulo "ACHADOS (X)"**: Remover o `h4` com icone ShieldAlert e texto "Achados (N)" (linhas 356-358), mantendo apenas os cards de findings diretamente

Apos as alteracoes, a aba "Analise" exibira apenas os cards de findings (SurfaceFindingCard) sem titulo de secao, ou a mensagem "Nenhum achado" caso vazio. O componente `MiniStat` pode ser removido tambem ja que nao sera mais utilizado.
