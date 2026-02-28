

## Plan: Cards de permissões com duas linhas internas

Voltar ao layout de duas linhas nos mini-cards: nome na primeira linha, descrição na segunda.

### `src/pages/environment/AddM365TenantPage.tsx`

**Linhas 434-438** — Alterar card Graph de `flex items-center gap-2` inline para layout vertical:
```
<div className="rounded-lg py-2 px-3 bg-muted/50 border border-border/50 space-y-0.5">
  <div className="flex items-center gap-2">
    <Check icon /> <span nome />
  </div>
  <p className="text-xs text-muted-foreground pl-5">{descrição}</p>
</div>
```

**Linhas 449-453** — Mesmo ajuste para cards RBAC.

### `src/pages/environment/M365TenantEditPage.tsx`

**Linhas 263-270** — Mesmo ajuste para cards Graph (com status dot).

**Linhas 282-289** — Mesmo ajuste para cards RBAC.

