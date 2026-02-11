

# Ajuste de Layout: Tela de Edição de Firewall + Padronização de Espaçamento

## Problema

A tela de edição de firewall (`FirewallEditPage`) está com layout estreito (`max-w-4xl mx-auto`) e não segue o padrão visual das demais páginas. Além disso, as páginas Firewalls, Execuções e Relatórios do módulo Firewall usam margens manuais (`mb-8`, `mb-6`) em vez do padrão `space-y-6`.

## Solução

### 1. FirewallEditPage - Ajuste de Layout

- Remover `max-w-4xl mx-auto` do container principal para que o conteúdo ocupe toda a largura disponível, igual às outras páginas
- Manter `space-y-6` no container (já está correto)
- O formulário dentro dos Cards pode usar `max-w-3xl` internamente se necessário para legibilidade dos inputs, mas os Cards em si ocupam largura total

Resultado: `p-6 lg:p-8 space-y-6` (sem max-w e sem mx-auto)

### 2. FirewallListPage - Padronizar espaçamento

Atual:
```text
<div className="p-6 lg:p-8">         (sem space-y-6)
  <PageBreadcrumb />
  <div className="... mb-8">          (margem manual)
  <FirewallStatsCards />              (sem espaçamento)
  <Card>                              (sem espaçamento)
```

Corrigir para:
```text
<div className="p-6 lg:p-8 space-y-6">
  <PageBreadcrumb />
  <div className="...">               (remover mb-8)
  <FirewallStatsCards />
  <Card>
```

### 3. FirewallReportsPage - Padronizar espaçamento

Atual:
```text
<div className="p-6 lg:p-8">         (sem space-y-6)
  <PageBreadcrumb />
  <div className="mb-8">              (margem manual)
  <div className="... mb-6">          (margem manual nos filtros)
```

Corrigir para:
```text
<div className="p-6 lg:p-8 space-y-6">
  <PageBreadcrumb />
  <div>                                (remover mb-8)
  <div className="...">               (remover mb-6)
```

### 4. TaskExecutionsPage (Execuções)

Esta página **já usa** `space-y-6` corretamente. Nenhuma alteração necessária.

## Detalhes Técnicos

### Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `src/pages/firewall/FirewallEditPage.tsx` | Remover `max-w-4xl mx-auto` do container |
| `src/pages/firewall/FirewallListPage.tsx` | Adicionar `space-y-6`, remover `mb-8` do header |
| `src/pages/firewall/FirewallReportsPage.tsx` | Adicionar `space-y-6`, remover `mb-8` e `mb-6` |

### Padrão de referência (ExternalDomainListPage)

```text
<AppLayout>
  <div className="p-6 lg:p-8 space-y-6">
    <PageBreadcrumb />
    <div className="flex ... gap-4">   (header, sem margin)
    <StatsCards />
    <Table />
  </div>
</AppLayout>
```
