
# Quebrar Textos Longos nos Labels do Donut

## Problema

Nomes de tecnologia longos como "ork Video Recorder http admin" estao sendo cortados porque ultrapassam a area visivel do card. Aumentar o `EDGE_MARGIN` nao resolve de forma sustentavel.

## Solucao

Truncar o nome da tecnologia com um limite maximo de caracteres e adicionar reticencias ("...") quando exceder. Isso garante que nenhum texto ultrapasse a borda do card, independente do tamanho do nome.

## Detalhes Tecnicos

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

1. Definir uma constante `MAX_LABEL_CHARS = 18` (suficiente para nomes como "Hikvision IPCam co...")
2. Na funcao `renderGroup`, truncar `item.name` antes de renderizar:
   - Se `item.name.length > MAX_LABEL_CHARS`, exibir `item.name.slice(0, MAX_LABEL_CHARS) + '...'`
   - Caso contrario, exibir o nome completo
3. Reduzir `EDGE_MARGIN` de volta para `120` ja que a truncagem resolve o problema de espaco
4. O tooltip do Recharts ja exibe o nome completo ao passar o mouse, entao nenhuma informacao e perdida
