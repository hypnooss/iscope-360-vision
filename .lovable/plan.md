

# Centralizar verticalmente os 3 cards no espaco restante

## Mudanca em `src/pages/AddAssetPage.tsx`

Envolver o grid dos cards em um container flex que ocupe todo o espaco restante abaixo do header (breadcrumb + titulo), centralizando verticalmente os cards dentro dele.

### Detalhes tecnicos

- Adicionar `flex flex-col` e `flex-1` no container pai (`div.p-6`) para que ele ocupe toda a altura disponivel
- Envolver o grid de cards em um `div` com `flex-1 flex items-center justify-center` para centralizar verticalmente no espaco restante
- Manter `max-w-lg` e `mx-auto` nos cards para centralizar horizontalmente

