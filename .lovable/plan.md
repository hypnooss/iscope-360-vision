
# Fix: Submenus inacessiveis no menu colapsado

## Problema

Quando o menu lateral esta colapsado, os modulos com submenus (Dominio Externo, Firewall, Microsoft 365, Administracao) mostram apenas um tooltip com o nome e navegam para a primeira rota ao clicar. Os subitens ficam completamente inacessiveis.

## Solucao

Substituir o `Tooltip` por um `HoverCard` (ou `Popover` com trigger hover) quando o sidebar esta colapsado, exibindo a lista completa de subitens ao passar o mouse sobre o icone do modulo.

## Detalhes Tecnicos

### Arquivo: `src/components/layout/AppLayout.tsx`

**ModuleButton (collapsed mode, linhas 316-337)**:
- Substituir `Tooltip` por `HoverCard` do Radix UI (ja instalado)
- O trigger sera o icone do modulo
- O content sera um mini-menu flutuante com fundo solido (`bg-sidebar`), posicionado a direita (`side="right"`)
- Cada subitem sera um `Link` com o mesmo estilo dos subitens expandidos
- O nome do modulo aparece como titulo no topo do mini-menu

**AdminButton (collapsed mode, linhas 420-440)**:
- Mesma abordagem: substituir `Tooltip` por `HoverCard`
- Exibir todos os itens de administracao (Administradores, Workspaces, Configuracoes, Templates, Agendamentos)
- Manter o estilo `warning` dos itens

### Estrutura visual do mini-menu (collapsed hover)

```text
+---------------------------+
| [icon] Nome do Modulo     |
|---------------------------|
| [icon] Subitem 1          |
| [icon] Subitem 2          |
| [icon] Subitem 3          |
+---------------------------+
```

- Fundo: `bg-sidebar` com `border border-sidebar-border`
- Sombra: `shadow-lg`
- z-index alto para ficar acima do conteudo
- Item ativo destacado com o mesmo estilo usado na sidebar expandida

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/components/layout/AppLayout.tsx` | Substituir Tooltip por HoverCard nos componentes ModuleButton e AdminButton quando colapsado |
