
# Barra de Rolagem para Lista de Arquivos

## Problema

A lista de arquivos no dialog de upload nao mostra barra de rolagem visivel quando ha muitos arquivos (ex: 17), fazendo parecer que so existem os primeiros itens.

## Solucao

O `ScrollArea` ja existe na linha 426, porem com `max-h-[240px]` que pode nao estar funcionando corretamente com o componente Radix. A correcao e simples:

**Arquivo:** `src/components/admin/ApiDocsManagement.tsx`

- Alterar o `ScrollArea` na linha 426 de `className="max-h-[240px]"` para `className="h-[300px]"` com uma altura fixa que garante o funcionamento do scroll
- Adicionar `overflow-hidden` ao wrapper para garantir que o conteudo nao vaze
- Isso ativara a barra de rolagem vertical automaticamente quando a lista ultrapassar 300px (~4-5 itens)

Alteracao de uma unica linha no arquivo.
