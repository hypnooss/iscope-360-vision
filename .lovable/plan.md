
# Ordenar itens do menu Administração alfabeticamente

## Problema

Os itens do menu "Administração" estão em ordem arbitrária. O pedido é organizá-los em **ordem alfabética**.

## Ordem atual

1. Administradores
2. Workspaces
3. Configurações
4. Templates
5. Agendamentos
6. CVEs
7. Super Agents

## Ordem correta (alfabética)

1. Administradores
2. Agendamentos
3. Configurações
4. CVEs
5. Super Agents
6. Templates
7. Workspaces

## Onde alterar

O arquivo é `src/components/layout/AppLayout.tsx`. Os itens aparecem em **dois lugares**:

### 1. Collapsed mode — HoverCard (linhas 479–486)

Array inline usado no `map()`:

```tsx
// Reordenar para:
{ href: '/administrators', icon: ShieldCheck, label: 'Administradores' },
{ href: '/schedules',      icon: Clock,       label: 'Agendamentos' },
{ href: '/settings',       icon: Settings,    label: 'Configurações' },
{ href: '/cves',           icon: Bug,         label: 'CVEs' },
{ href: '/super-agents',   icon: Cpu,         label: 'Super Agents' },
{ href: '/templates',      icon: ClipboardList, label: 'Templates' },
{ href: '/workspaces',     icon: Building,    label: 'Workspaces' },
```

### 2. Expanded mode — Collapsible (linhas 538–628)

Blocos `<Link>` individuais reordenados na mesma sequência:

```
Administradores → Agendamentos → Configurações → CVEs → Super Agents → Templates → Workspaces
```

## Arquivo modificado

- `src/components/layout/AppLayout.tsx`
