

# Distribuir Labels Verticalmente de Forma Uniforme

## Problema

Os labels estao amontoados verticalmente porque:
1. O `MIN_SPACING` de 28px e insuficiente para labels de duas linhas (nome + valor)
2. O algoritmo so empurra labels para baixo quando colidem, mas nao centraliza o grupo resultante em torno do centro do grafico
3. Quando varios segmentos tem angulos proximos, todos os labels naturais ficam na mesma faixa de Y

## Solucao

Melhorar o algoritmo de anti-colisao para:
- Aumentar `MIN_SPACING` para 38px (acomodar duas linhas de texto com folga)
- Apos resolver colisoes, centralizar o bloco de labels verticalmente em torno de `cy` (centro do grafico), garantindo distribuicao equilibrada
- Limitar os labels entre `minY = 20` e `maxY = height - 20`

## Detalhe Tecnico

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

1. **Aumentar MIN_SPACING** de 28 para 38
2. **Reescrever `resolveCollisions`** para centralizar o grupo:
   - Primeiro resolve colisoes normalmente (empurra para baixo)
   - Calcula a altura total do bloco resultante
   - Calcula o offset necessario para centralizar o bloco em torno de `cy`
   - Aplica o offset, respeitando limites `minY` e `maxY`
   - Re-resolve colisoes caso o ajuste tenha comprimido labels no topo
3. **Passar `cy` como parametro** para a funcao de resolucao para permitir centralizacao

A funcao revisada ficara assim (em pseudocodigo):

```text
resolveCollisions(group):
  // Passo 1: resolver sobreposicoes
  para cada label apos o primeiro:
    se distancia ao anterior < MIN_SPACING:
      mover para anterior.Y + MIN_SPACING

  // Passo 2: centralizar em torno de cy
  topoBloco = primeiro label Y
  baseBloco = ultimo label Y
  centroBloco = (topoBloco + baseBloco) / 2
  offset = cy - centroBloco
  aplicar offset a todos os labels

  // Passo 3: garantir limites
  se primeiro label < minY: ajustar tudo para baixo
  se ultimo label > maxY: ajustar tudo para cima

  // Passo 4: re-resolver colisoes
  repetir passo 1
```

Nenhuma alteracao necessaria em `SeverityTechDonut.tsx`.

