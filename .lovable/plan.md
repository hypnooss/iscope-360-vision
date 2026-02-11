

# Ajustes nos Modulos Desabilitados do Menu

## Alteracoes em `src/components/layout/AppLayout.tsx`

### 1. Remover tooltip "Modulo nao contratado"

O `DisabledModuleButton` passara a renderizar apenas o `div` sem o wrapper `Tooltip`/`TooltipTrigger`/`TooltipContent`. Manter o tooltip apenas quando a sidebar estiver colapsada (para mostrar o nome do modulo, igual aos outros itens).

### 2. Ordenar todos os modulos alfabeticamente (acessiveis + inacessiveis juntos)

Em vez de renderizar primeiro os acessiveis e depois os inacessiveis, construir uma lista unica de todos os modulos ativos, ordenada por nome, e renderizar cada um como `ModuleButton` ou `DisabledModuleButton` conforme o acesso do usuario.

Logica:

```ts
const allModulesSorted = allActiveModules
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name));

// No JSX:
{allModulesSorted.map(module => {
  const hasAccess = effectiveUserModules.some(em => em.module.code === module.code);
  if (hasAccess) {
    const config = accessibleModuleConfigs.find(c => c.code === module.code);
    return config ? <ModuleButton key={module.id} moduleConfig={config} /> : null;
  }
  return <DisabledModuleButton key={module.id} module={module} />;
})}
```

Isso substituira os dois blocos separados (accessible + inaccessible) por um unico bloco ordenado.

## Resumo

| Alteracao | Detalhe |
|-----------|---------|
| Remover tooltip | Manter tooltip apenas com o nome quando sidebar colapsada |
| Ordem alfabetica | Lista unica de todos os modulos ativos, ordenada por `name` |
| Arquivo | `src/components/layout/AppLayout.tsx` |

