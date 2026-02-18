
# Exibir Fabricante como Badge

## Diagnóstico

Analisando o arquivo `src/pages/firewall/FirewallReportsPage.tsx` (linhas 584-590), a situação atual das três colunas é:

| Coluna | Situação atual |
|---|---|
| **Fabricante** | `<span className="text-sm text-foreground">` — simples texto |
| **Agent** | `<Badge variant="outline">` — já é badge |
| **Frequência** | `<Badge variant="secondary">` — já é badge |

Apenas a coluna **Fabricante** precisa ser convertida para `Badge`.

## Mudança

**Arquivo:** `src/pages/firewall/FirewallReportsPage.tsx` — linhas 585-589

**Antes:**
```tsx
{group.vendor_name ? (
  <span className="text-sm text-foreground">{group.vendor_name}</span>
) : (
  <span className="text-muted-foreground text-sm">—</span>
)}
```

**Depois:**
```tsx
{group.vendor_name ? (
  <Badge variant="outline" className="text-xs">{group.vendor_name}</Badge>
) : (
  <span className="text-muted-foreground text-sm">—</span>
)}
```

Usando `variant="outline"` para consistência com a coluna Agent (mesma família visual).
