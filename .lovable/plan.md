
# Ajuste de Espaçamento — Firewall Analyzer Dashboard

## Problema

Na tela `Firewall > Analyzer` (`AnalyzerDashboardPage.tsx`), o breadcrumb fica com espaçamento insuficiente em relação ao título "Analyzer" (indicado pelas setas vermelhas).

## Causa

O wrapper principal da página usa `className="p-6 lg:p-8"` **sem** `space-y-6`, e o div do cabeçalho tem `mb-8` para compensar manualmente. Esse padrão difere de todas as outras telas da aplicação.

## Padrão correto (todas as outras telas)

Todas as outras páginas (Compliance, Surface Analyzer, etc.) seguem este padrão:

```tsx
// wrapper principal
<div className="p-6 lg:p-8 space-y-6">
  <PageBreadcrumb ... />
  
  {/* Header sem mb-X */}
  <div className="flex flex-col md:flex-row ...">
    ...
  </div>
  ...
</div>
```

O `space-y-6` no wrapper aplica `margin-top: 1.5rem` automaticamente entre todos os filhos diretos, gerando o espaçamento correto e consistente.

## Correção

Em `src/pages/firewall/AnalyzerDashboardPage.tsx`, **linha 382**:

**Antes:**
```tsx
<div className="p-6 lg:p-8">
  <PageBreadcrumb items={[{ label: 'Firewall' }, { label: 'Analyzer' }]} />

  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
```

**Depois:**
```tsx
<div className="p-6 lg:p-8 space-y-6">
  <PageBreadcrumb items={[{ label: 'Firewall' }, { label: 'Analyzer' }]} />

  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
```

Duas mudanças simples:
1. Adicionar `space-y-6` ao wrapper principal (linha 382)
2. Remover `mb-8` do div do cabeçalho (linha 385)

## Arquivo modificado

- `src/pages/firewall/AnalyzerDashboardPage.tsx`
