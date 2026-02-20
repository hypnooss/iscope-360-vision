

# Indicador de Clique nos Cards de Categoria

## Alteracao

Adicionar um icone `ExternalLink` (ou `ChevronRight`) no canto inferior direito de cada card do `CategoryOverviewGrid` para indicar visualmente que sao clicaveis e abrem o painel lateral.

## Detalhe Tecnico

**Arquivo:** `src/components/surface/CategoryOverviewGrid.tsx`

1. Importar `ExternalLink` de `lucide-react`
2. Dentro de cada `<Card>`, apos as badges de severidade e antes do fechamento do `</CardContent>`, adicionar o icone posicionado no canto inferior direito:

```tsx
<div className="flex justify-end mt-1">
  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
</div>
```

O icone fica sutil (muted/50) e ganha destaque no hover do card (gracas a classe `group` ja existente no Card). Nenhuma alteracao no comportamento de clique — o `onClick` existente continua abrindo o Sheet lateral.

