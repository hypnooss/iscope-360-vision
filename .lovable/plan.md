

# Corrigir Posicionamento de Bolinha e Texto por Quadrante

## Problema
O texto e a bolinha (circle) sempre seguem o mesmo layout vertical: nome acima, valor abaixo. Isso ignora a direcao do quadrante. No quadrante inferior, "Outros" tem o texto subindo quando deveria estar descendo. "MikroTik bandwidth" no topo-direito tambem fica desalinhado.

## Solucao
Ajustar o posicionamento vertical do texto e da bolinha com base no quadrante:
- **Quadrantes de topo** (top-right, top-left): bolinha no ponto final da linha, texto ACIMA da bolinha (nome primeiro, valor abaixo do nome, ambos acima do ponto)
- **Quadrantes de baixo** (bottom-right, bottom-left): bolinha no ponto final da linha, texto ABAIXO da bolinha (nome primeiro, valor abaixo do nome, ambos abaixo do ponto)

## Detalhes Tecnicos

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

Alterar a funcao `renderGroup` (linhas 159-213):

1. Determinar se o quadrante e de topo ou de baixo:
```text
const isTop = item.quadrant === 'top-right' || item.quadrant === 'top-left';
```

2. Ajustar posicao Y do texto com base na direcao:
- **Topo**: nome em `ey3 - 16`, valor em `ey3 - 3` (texto sobe, bolinha fica embaixo)
- **Baixo**: nome em `ey3 + 5`, valor em `ey3 + 18` (texto desce, bolinha fica em cima)

Isso faz com que o fluxo visual siga a direcao natural: nos quadrantes superiores o texto "puxa" para cima, nos inferiores "puxa" para baixo, mantendo a bolinha como ancora no ponto final da linha de conexao.

