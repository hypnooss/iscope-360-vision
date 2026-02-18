
# Renomear "Relatórios" para "Compliance" e Reordenar o Menu Firewall

## O que será alterado

São apenas **2 arquivos** com mudanças mínimas:

---

## 1. Menu lateral — `src/components/layout/AppLayout.tsx`

Na configuração `scope_firewall` (linhas 117-123), duas mudanças:

**a) Renomear o label** de `'Relatórios'` para `'Compliance'`

**b) Reordenar** para que `Compliance` fique acima de `Analyzer`:

```
Antes:
  Firewalls
  Analyzer
  CVEs
  Execuções
  Relatórios   ← no final

Depois:
  Firewalls
  Compliance   ← sobe para cima do Analyzer
  Analyzer
  CVEs
  Execuções
```

---

## 2. Tela de Relatórios — `src/pages/firewall/FirewallReportsPage.tsx`

Atualizar os textos da página:

| Localização | Antes | Depois |
|---|---|---|
| `PageBreadcrumb` (linha 337) | `Relatórios` | `Compliance` |
| Título `<h1>` (linha 342) | `Relatórios` | `Compliance` |
| Descrição `<p>` (linha 343) | `Histórico de análises de compliance` | `Histórico de análises de compliance` *(mantém)* |

---

## Resumo dos arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/layout/AppLayout.tsx` | Label `Relatórios` → `Compliance` + reordenação dos items |
| `src/pages/firewall/FirewallReportsPage.tsx` | Breadcrumb + título `Relatórios` → `Compliance` |
