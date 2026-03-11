

## Colorir Badges de Ação (Add/Delete/Edit) na página Config Changes

Alterar a Badge de ação na tabela (linha 882) e no detalhe expandido (linha 910) para usar cores semânticas:

- **Add** → fundo verde (`bg-emerald-500/20 text-emerald-400 border-emerald-500/30`)
- **Delete** → fundo vermelho (`bg-red-500/20 text-red-400 border-red-500/30`)
- **Edit** → manter estilo atual (outline neutro)

### Implementação

**Arquivo:** `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

1. Adicionar helper para mapear ação → classes CSS:
```ts
const actionBadgeColors: Record<string, string> = {
  add: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  delete: 'bg-red-500/20 text-red-400 border-red-500/30',
  del: 'bg-red-500/20 text-red-400 border-red-500/30',
};
```

2. Atualizar as duas Badges de ação (linhas 882 e 910) para aplicar as classes condicionalmente baseado em `d.action.toLowerCase()`.

