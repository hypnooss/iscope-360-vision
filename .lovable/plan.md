
# Mostrar Modulos Sem Acesso no Menu (Cinza/Desativado)

## Objetivo

Modulos ativos que o usuario nao tem acesso devem aparecer no menu lateral em cinza, sem acao (nao expande, nao navega), servindo como vitrine para o cliente saber que existem outros modulos disponiveis.

## Alteracoes

### 1. `src/hooks/useEffectiveModules.ts`

Expor a lista completa de modulos ativos (`allModules`) alem dos modulos acessiveis. Importar `modules` do `ModuleContext` e retorna-lo como `allActiveModules`.

### 2. `src/components/layout/AppLayout.tsx`

**Construir a lista de modulos do menu** combinando modulos acessiveis + modulos sem acesso:

- Pegar `allActiveModules` do hook `useEffectiveModules`
- Filtrar os que NAO estao em `effectiveUserModules`
- Renderizar esses como items desabilitados

**Criar componente `DisabledModuleButton`**:

- Exibe icone e nome do modulo
- Cor cinza (`text-muted-foreground/50`) no icone e texto
- Cursor `cursor-default` (sem pointer)
- Sem onClick, sem Link, sem Collapsible
- Tooltip com mensagem tipo "Modulo nao contratado" quando sidebar esta colapsado
- Opacidade reduzida (`opacity-50`)

**Ordem de renderizacao**:

1. Modulos acessiveis (com interacao normal, como hoje)
2. Modulos sem acesso (cinza, desabilitados) -- na mesma lista, ordenados por nome

Na pratica, todos os modulos ativos serao mapeados juntos e ordenados, cada um renderizado como `ModuleButton` (se acessivel) ou `DisabledModuleButton` (se sem acesso).

## Detalhes Tecnicos

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useEffectiveModules.ts` | Adicionar `allActiveModules: Module[]` ao retorno |
| `src/components/layout/AppLayout.tsx` | Criar `DisabledModuleButton`, combinar modulos acessiveis + desabilitados no menu |

### Visual do item desabilitado

```text
+----------------------------------+
|  [icon cinza]  Nome do Modulo    |
|  opacity-50, cursor-default      |
|  sem hover effect                |
+----------------------------------+
```
