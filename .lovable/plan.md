

# Exibir estado vazio quando não há coleta recente

## Alteração

**Arquivo**: `src/pages/m365/CollaborationPage.tsx`

Após o card de contexto do tenant (linha 114) e o bloco de erro, adicionar uma condicional: se `!loading && !d && !error`, renderizar um card informativo com ícone e mensagem dizendo que não há coleta recente, com botão para iniciar a primeira coleta (usando o `refresh`).

Quando esse estado vazio for exibido, as seções de Score, Teams Overview, Teams Governance e SharePoint ficam ocultas (wrap com `{d && (...)}`) para não mostrar skeletons/zeros sem sentido.

## Detalhes

- Ícone: `AlertTriangle` ou `RefreshCw` centralizado
- Texto: "Nenhuma coleta recente disponível" + subtexto "Clique em Atualizar para iniciar a primeira coleta de dados de colaboração."
- Botão: "Atualizar agora" que chama `refresh()`
- Estilo: `border-muted bg-muted/5`, similar ao card de "tenant não conectado"

