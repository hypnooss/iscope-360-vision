
# Remover Menu e Tela "Firewall > Firewalls"

## O que será removido

1. **Item de menu** "Firewalls" no sidebar (AppLayout.tsx)
2. **Rota** `/scope-firewall/firewalls` e página `FirewallListPage`
3. **Rotas filhas** relacionadas: `/scope-firewall/firewalls/new` e `/scope-firewall/firewalls/:id/edit`

## Impactos e redirecionamentos necessários

Vários outros arquivos referenciam `/scope-firewall/firewalls` como destino de navegação (botões "Voltar", breadcrumbs, redirects pós-save). Todos precisam ser atualizados para apontar a uma rota ainda existente.

Destino substituto: **`/scope-firewall/reports`** (Compliance), que é a tela principal do módulo de Firewall.

## Arquivos a modificar

### 1. `src/components/layout/AppLayout.tsx` — linha 118
Remover o item "Firewalls" do array `items` de `scope_firewall`:

**Antes:**
```ts
items: [
  { label: 'Firewalls', href: '/scope-firewall/firewalls', icon: Server },
  { label: 'Compliance', href: '/scope-firewall/reports', icon: FileText },
  ...
]
```

**Depois:**
```ts
items: [
  { label: 'Compliance', href: '/scope-firewall/reports', icon: FileText },
  ...
]
```

---

### 2. `src/App.tsx` — remover 4 rotas
```tsx
// Remover:
<Route path="/scope-firewall/firewalls" element={<FirewallListPage />} />
<Route path="/scope-firewall/firewalls/new" element={<FirewallCreatePage />} />
<Route path="/scope-firewall/firewalls/:id/analysis" element={<FirewallAnalysis />} />
<Route path="/scope-firewall/firewalls/:id/edit" element={<FirewallEditPage />} />
```

E também remover as lazy imports de `FirewallListPage`, `FirewallCreatePage`, `FirewallEditPage`.

**Atenção:** A rota `/:id/analysis` é usada para abrir o relatório a partir do Compliance. Ela deve ser **mantida** — apenas as rotas de lista, criação e edição são removidas.

---

### 3. `src/pages/FirewallAnalysis.tsx`
- Breadcrumb: `{ label: 'Firewall', href: '/scope-firewall/firewalls' }` → `href: '/scope-firewall/reports'`
- Botão "Voltar": `navigate('/scope-firewall/firewalls')` → `navigate('/scope-firewall/reports')`

---

### 4. `src/pages/firewall/FirewallReportsPage.tsx` — linha 556
Botão "Ver Firewalls":
```tsx
onClick={() => navigate('/scope-firewall/firewalls')}
```
→ remover o botão ou redirecionar para `/scope-firewall/reports`.

---

### 5. `src/pages/firewall/FirewallCVEsPage.tsx` — breadcrumb
```tsx
{ label: 'Firewall', href: '/scope-firewall/firewalls' }
```
→ `href: '/scope-firewall/reports'`

---

### 6. `src/pages/firewall/TaskExecutionsPage.tsx` — breadcrumb
Mesma correção: `href: '/scope-firewall/firewalls'` → `href: '/scope-firewall/reports'`

---

### 7. `src/pages/firewall/AnalyzerInsightsPage.tsx` — breadcrumb
Mesma correção.

---

### 8. `src/pages/firewall/FirewallEditPage.tsx`
- Breadcrumb `Firewalls` → remover item ou apontar para `/scope-firewall/reports`
- `navigate('/scope-firewall/firewalls')` (após salvar e ao cancelar) → `/scope-firewall/reports`

---

### 9. `src/pages/firewall/FirewallCreatePage.tsx`
- Breadcrumb e botões "Cancelar" / "Voltar" → `/scope-firewall/reports`
- `navigate('/scope-firewall/firewalls')` após criar → `/scope-firewall/reports`

---

### 10. `src/pages/EnvironmentPage.tsx` — linha 118 e 335
Referências de navegação para `/scope-firewall/firewalls/:id/edit` podem ser mantidas caso a rota de edição continue existindo acessível por outros meios. Caso contrário, apontar para `/scope-firewall/reports`.

## Resumo das rotas — Antes × Depois

| Rota | Ação |
|---|---|
| `/scope-firewall/firewalls` | **Remover** |
| `/scope-firewall/firewalls/new` | Avaliar: remover ou manter acessível via URL direta |
| `/scope-firewall/firewalls/:id/edit` | Avaliar: manter ou remover |
| `/scope-firewall/firewalls/:id/analysis` | **Manter** (usado pelo Compliance) |

## Arquivos afetados

- `src/components/layout/AppLayout.tsx`
- `src/App.tsx`
- `src/pages/FirewallAnalysis.tsx`
- `src/pages/firewall/FirewallReportsPage.tsx`
- `src/pages/firewall/FirewallCVEsPage.tsx`
- `src/pages/firewall/TaskExecutionsPage.tsx`
- `src/pages/firewall/AnalyzerInsightsPage.tsx`
- `src/pages/firewall/FirewallEditPage.tsx`
- `src/pages/firewall/FirewallCreatePage.tsx`
