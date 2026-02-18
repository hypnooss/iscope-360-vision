
# Remover o link do nível "Firewall" nas breadcrumbs

## Problema

Em várias páginas do módulo Firewall, o primeiro item da breadcrumb é `{ label: 'Firewall', href: '...' }`. Como a tela Firewalls foi removida, esse link leva a rotas inexistentes ou indesejadas. O pedido é: **manter o efeito de hover, mas remover qualquer ação de clique**.

## Solução

O componente `PageBreadcrumb` já tem esse comportamento implementado: quando um item de nível intermediário **não tem `href`**, ele é renderizado como `<span>` com `hover:text-primary transition-colors cursor-default` — exatamente o comportamento desejado.

Basta remover a propriedade `href` dos itens `{ label: 'Firewall' }` nas páginas afetadas.

## Arquivos e mudanças

### `src/pages/firewall/FirewallReportsPage.tsx`
```tsx
// Antes:
{ label: 'Firewall', href: '/scope-firewall/dashboard' }

// Depois:
{ label: 'Firewall' }
```

### `src/pages/firewall/AnalyzerDashboardPage.tsx`
```tsx
// Antes:
{ label: 'Firewall', href: '/scope-firewall/firewalls' }

// Depois:
{ label: 'Firewall' }
```

### `src/pages/firewall/AnalyzerCriticalPage.tsx`
```tsx
// Antes:
{ label: 'Firewall', href: '/scope-firewall/firewalls' }

// Depois:
{ label: 'Firewall' }
```

### `src/pages/firewall/AnalyzerConfigChangesPage.tsx`
```tsx
// Antes:
{ label: 'Firewall', href: '/scope-firewall/firewalls' }

// Depois:
{ label: 'Firewall' }
```

## Páginas que NÃO precisam de alteração

As páginas abaixo já têm "Compliance" (com href) como primeiro item — não há `{ label: 'Firewall' }` no breadcrumb:

- `FirewallCVEsPage.tsx` — `Compliance > CVEs`
- `TaskExecutionsPage.tsx` — `Compliance > Execuções`
- `AnalyzerInsightsPage.tsx` — `Compliance > Analyzer > Insights`

## Como ficará o comportamento

O componente `PageBreadcrumb` tem o seguinte branch para itens intermediários sem `href`:

```tsx
<span className="text-muted-foreground hover:text-primary transition-colors cursor-default">
  {item.label}
</span>
```

- Hover: muda a cor para `primary` (efeito visual mantido)
- Cursor: `default` (sem indicação de link clicável)
- Clique: nenhuma ação

## Arquivos modificados

1. `src/pages/firewall/FirewallReportsPage.tsx`
2. `src/pages/firewall/AnalyzerDashboardPage.tsx`
3. `src/pages/firewall/AnalyzerCriticalPage.tsx`
4. `src/pages/firewall/AnalyzerConfigChangesPage.tsx`
