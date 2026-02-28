

## Plano: Centralizar título verticalmente com o ícone de status

### Problema
O título e o ícone estão alinhados ao topo (`items-start`). O usuário quer que o título fique centralizado verticalmente em relação ao ícone.

### Mudanças em `src/components/compliance/UnifiedComplianceCard.tsx`

1. **Linha 210-211**: Mudar ambos os `flex items-start` para `flex items-center` nos containers pai
2. **Linha 213**: Remover o `mt-0.5` do ícone (não precisa mais de compensação manual)
3. **Linha 219**: A row do título+badge já usa `items-center`, manter assim

Resultado: o ícone e a primeira linha (título + badge) ficam centralizados verticalmente entre si, como na segunda imagem do print.

