

## Aumentar truncamento de entidades no preview de 3 para 15

### Problema
A função RPC `get_posture_insights_lite` limita `_entitiesPreview` a apenas 3 nomes (`WHERE idx <= 3`). Como agora esses dados são exibidos na janela lateral (sheet) com espaço adequado, o limite pode ser maior.

### Solução
Migração SQL para recriar a função `get_posture_insights_lite` alterando `WHERE idx <= 3` para `WHERE idx <= 15` nos dois pontos (insights e agent_insights).

### Arquivo
- Nova migração SQL atualizando a função `get_posture_insights_lite`

