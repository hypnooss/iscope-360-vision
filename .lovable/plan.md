

# Reduzir largura dos campos Agent e Frequência

## Problema

Os campos "Agent" e "Frequência" ocupam 100% da largura do card, ficando desproporcionalmente grandes comparados aos demais campos que estão em grid de 2 colunas.

## Solução

1. **Campo Agent**: Mover para dentro do grid de 2 colunas (`grid-cols-1 md:grid-cols-2`), ao lado do campo Workspace/Domínio, ou em uma linha própria mas limitado a metade da largura.

2. **Campo Frequência**: Colocar dentro de um grid de 2 colunas também, ocupando apenas metade da largura.

## Detalhes técnicos

No arquivo `src/pages/AddExternalDomainPage.tsx`:

- Envolver o campo Agent em um `grid grid-cols-1 md:grid-cols-2` para que ocupe apenas metade da largura (coluna esquerda)
- Fazer o mesmo com o campo Frequência no card de Agendamento
- Os campos condicionais de horário/dia já estão em grid de 2 colunas, mantê-los como estão

