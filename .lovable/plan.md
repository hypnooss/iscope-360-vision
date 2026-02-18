
# Corrigir Breadcrumb na Página de Análise de Firewall

## Problema

No arquivo `src/pages/FirewallAnalysis.tsx`, o breadcrumb exibe:

```
Firewall > Relatórios > [Nome do Firewall]
```

Mas deveria exibir:

```
Firewall > Compliance > [Nome do Firewall]
```

## Ocorrências a corrigir

Há **duas** instâncias do breadcrumb no arquivo — uma no estado de "sem relatório" e outra no estado normal de exibição:

**Linhas ~242-247 (estado sem relatório):**
```tsx
<PageBreadcrumb
  items={[
    { label: 'Firewall', href: '/scope-firewall/firewalls' },
    { label: 'Relatórios', href: '/scope-firewall/reports' },  // ← ERRADO
    { label: firewall?.name || 'Análise' },
  ]}
/>
```

**Linhas ~268-273 (estado normal):**
```tsx
<PageBreadcrumb
  items={[
    { label: 'Firewall', href: '/scope-firewall/firewalls' },
    { label: 'Relatórios', href: '/scope-firewall/reports' },  // ← ERRADO
    { label: firewall?.name || 'Análise de Compliance' },
  ]}
/>
```

## Correção

Substituir `'Relatórios'` por `'Compliance'` em ambas as ocorrências. O href `/scope-firewall/reports` permanece o mesmo pois é a rota da página de Compliance.

**Arquivo alterado:** `src/pages/FirewallAnalysis.tsx` — duas linhas modificadas.
