
# Plano: Corrigir Breadcrumb da Análise de Firewall

## Problema Identificado

O breadcrumb atual na página de análise (`FirewallAnalysis.tsx`) mostra:
- **Atual**: `Scope Firewall > Firewalls > SONICVRAU-TESTE`
- **Esperado**: `Firewall > Relatórios > SONICVRAU-TESTE`

## Alterações Necessárias

### Arquivo: `src/pages/FirewallAnalysis.tsx`

Atualizar os dois locais onde o `PageBreadcrumb` é utilizado (linhas 244-250 e 267-273):

**De:**
```jsx
<PageBreadcrumb
  items={[
    { label: 'Scope Firewall', href: '/scope-firewall/firewalls' },
    { label: 'Firewalls', href: '/scope-firewall/firewalls' },
    { label: firewall?.name || 'Análise' },
  ]}
/>
```

**Para:**
```jsx
<PageBreadcrumb
  items={[
    { label: 'Firewall', href: '/scope-firewall/firewalls' },
    { label: 'Relatórios', href: '/scope-firewall/reports' },
    { label: firewall?.name || 'Análise' },
  ]}
/>
```

## Detalhes Técnicos

| Local | Linha | Mudança |
|-------|-------|---------|
| Estado vazio (sem análise) | 244-250 | Atualizar labels e href do segundo item |
| Estado com relatório | 267-273 | Atualizar labels e href do segundo item |

## Consistência

Esta alteração alinha o breadcrumb da análise individual com o padrão já utilizado em `FirewallReportsPage.tsx` (linha 265-268), que usa `Firewall > Relatórios`.
