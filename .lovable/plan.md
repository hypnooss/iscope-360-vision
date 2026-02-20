

# Melhorar Posicionamento dos Labels do Donut

## Problema

A logica atual divide labels em esquerda/direita baseando-se apenas no cosseno do angulo medio da fatia. Isso faz com que fatias no topo do donut (como SSL) caiam no lado esquerdo mesmo quando sua fatia esta visualmente mais a direita. Alem disso, o algoritmo de anti-colisao empurra labels para baixo sequencialmente, afastando-os da posicao real da fatia.

## Solucao Proposta

Alterar a logica de posicionamento para que os labels fiquem mais proximos da fatia correspondente no donut, usando uma abordagem que respeita melhor a posicao angular real.

## Detalhes Tecnicos

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

**1. Balancear a distribuicao esquerda/direita**

Atualmente a divisao e `cos(angulo) >= 0 -> direita`. Quando ha muitos labels de um lado so, a colisao os empurra para longe. Uma abordagem melhor:
- Contar quantos labels cairiam em cada lado
- Se um lado tiver muito mais que o outro, mover labels que estao proximo do limite (angulos proximos de 90 ou 270 graus) para o lado com menos labels

**2. Usar posicao angular para ordenar, nao apenas Y natural**

Ao inves de centralizar o bloco inteiro de labels no `cy`, ancorar cada label o mais proximo possivel do seu Y natural (posicao real da fatia), aplicando anti-colisao apenas onde necessario.

**3. Melhorar o algoritmo de anti-colisao**

Substituir o esquema atual de "empurrar para baixo" por um que distribui os labels simetricamente ao redor da posicao natural:
- Quando dois labels colidem, mover ambos (um para cima, outro para baixo) em vez de so empurrar o debaixo
- Remover o passo de "centralizar bloco inteiro no cy" que desloca todos os labels da posicao real

Isso fara com que o SSL, cuja fatia esta no topo-direita, fique posicionado no lado direito e proximo do topo, como voce indicou no print 2.

