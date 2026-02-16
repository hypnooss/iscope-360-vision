
# Corrigir quebra de pagina na tabela de Subdominios do PDF

## Problema

Na exportacao PDF, a secao de Subdominios usa um layout de duas colunas (`flexDirection: 'row'`). O `@react-pdf/renderer` nao consegue quebrar corretamente Views com `flexDirection: row` entre paginas — as colunas esquerda e direita quebram de forma independente, resultando em cards cortados e desalinhados.

## Solucao

Substituir o layout de duas colunas por um layout de linha unica (uma coluna), onde cada par de subdominios e renderizado em uma linha horizontal com `wrap={false}`. Isso garante que cada linha seja uma unidade atomica que nao sera cortada, e a quebra de pagina ocorre apenas entre linhas.

## Mudancas

### Arquivo: `src/components/pdf/sections/PDFDNSMap.tsx`

**1. Criar componente `SubdomainRow`**

Um componente simples que renderiza dois `ValueCard` lado a lado em uma View com `wrap={false}` e `flexDirection: 'row'`.

**2. Refatorar a secao de Subdominios**

Em vez de dividir subdominios em duas colunas separadas (left/right), agrupar em pares e renderizar cada par como um `SubdomainRow`:

```text
// Antes (duas colunas independentes):
<View style={twoColumnContainer}>
  <View style={columnLeft}>  -- coluna esquerda inteira
  <View style={column}>      -- coluna direita inteira

// Depois (linhas de pares):
subdominios em pares de 2:
  <View wrap={false} flexDirection="row">
    <ValueCard ... />   <ValueCard ... />
  </View>
  <View wrap={false} flexDirection="row">
    <ValueCard ... />   <ValueCard ... />
  </View>
```

**3. Aplicar para ambos os blocos**

- Bloco inicial (primeiros 4 subdominios): manter `wrap={false}` no bloco inteiro (ja funciona)
- Bloco restante (subdominios 5-20): refatorar para usar pares com `wrap={false}` individual

Isso garante que cada par de subdominios nunca sera cortado entre paginas, enquanto a quebra de pagina pode ocorrer entre qualquer par.
