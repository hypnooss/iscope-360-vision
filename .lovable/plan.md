

# Mapa Realista e Correção de Config Changes Vazias

## Problemas Identificados

1. **Mapa**: Os paths SVG atuais (`CONTINENT_PATHS`) sao formas geometricas aproximadas, nao parecem um mapa real. Precisam ser substituidos por contornos reais de paises.

2. **Config Changes vazio**: O banco confirma que o snapshot mais recente (BAU-FW) tem `configChanges: 3` mas `configChangeDetails: null`. Isso aconteceu porque o snapshot foi processado ANTES da versao do edge function que gera `configChangeDetails` ser implantada. A logica no codigo esta correta - basta reimplantar o edge function e re-executar a analise.

3. **Visual dos Top IPs/Paises**: O screenshot mostra que o visual atual ja esta bom (bandeiras, barras de progresso, layout limpo). Nenhuma alteracao necessaria.

## Mudancas

### 1. Mapa Realista (`AttackMap.tsx`)

Substituir os `CONTINENT_PATHS` por um mapa mundial real usando a abordagem:

- Utilizar uma imagem de mapa mundial escuro como fundo (PNG embutido via URL publica ou asset local)
- Manter o SVG overlay com os pontos de ataque (pulses, cores, tooltips)
- Usar uma imagem de mapa dark-themed de alta qualidade posicionada como background do container SVG
- O SVG fica transparente (sem os paths de continentes), apenas com grid sutil e os pontos de ataque
- Coordenadas projetadas com a mesma funcao equiretangular ja existente

Alternativa (mais robusta): Usar paths SVG de paises reais extraidos do Natural Earth (110m simplificado). Isso requer paths maiores (~40KB) mas garante um mapa vetorial nitido em qualquer resolucao. Cada pais tera seu proprio path com preenchimento escuro e borda sutil.

Decisao: Usar paths SVG reais do Natural Earth para manter tudo vetorial e responsivo. Os paths serao agrupados por regiao (Americas, Europa, Africa, Asia, Oceania) com coordenadas de projecao equiretangular pre-calculadas para o viewBox 2000x1000.

### 2. Reimplantar Edge Function

- Reimplantar `firewall-analyzer` para garantir que a versao com `configChangeDetails` esteja ativa
- Apos reimplantacao, o usuario deve executar nova analise para gerar os detalhes

### 3. Sem alteracoes nos widgets de IPs/Paises

O visual atual (screenshot image-318) ja esta adequado com bandeiras, barras de progresso e layout limpo.

## Secao tecnica

### Paths SVG reais

Os paths do Natural Earth 110m serao convertidos para projecao equiretangular com viewBox `0 0 2000 1000`. Cada pais sera um `<path>` com:
- `fill="hsl(var(--muted))"` com opacidade 0.4
- `stroke="hsl(var(--muted-foreground))"` com opacidade 0.2 e strokeWidth 0.5

Os paths reais cobrem ~180 paises com contornos precisos. O arquivo ficara maior (~50-80KB de paths) mas garante fidelidade visual.

A funcao `project()` sera ajustada para o novo viewBox:
```text
function project(lat, lng) {
  const x = ((lng + 180) / 360) * 2000;
  const y = ((90 - lat) / 180) * 1000;
  return [x, y];
}
```

### Reimplantacao do edge function

O codigo atual em `firewall-analyzer/index.ts` ja gera `configChangeDetails` corretamente (linhas 516-531). O problema e que a versao implantada nao inclui essa logica. Reimplantar resolve.

### Arquivos a editar

- **Editar**: `src/components/firewall/AttackMap.tsx` - Substituir CONTINENT_PATHS por paths reais do Natural Earth
- **Reimplantar**: `supabase/functions/firewall-analyzer` - Garantir versao mais recente ativa

