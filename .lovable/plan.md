

# Plano: Colorização dos Cards MiniStat

## Alterações no Componente MiniStat

### Arquivo: `src/pages/preview/DomainReportPreview.tsx`

Modificar o componente `MiniStat` para incluir estilos de borda e background coloridos por variante:

```tsx
function MiniStat({ value, label, variant = "default" }: MiniStatProps) {
  const variantStyles = {
    default: {
      text: "text-foreground",
      border: "border-border/30",
      bg: "bg-background/50"
    },
    success: {
      text: "text-sky-400",
      border: "border-sky-500/30",
      bg: "bg-sky-500/10"
    },
    destructive: {
      text: "text-rose-400",
      border: "border-rose-500/30",
      bg: "bg-rose-500/10"
    }
  };

  const style = variantStyles[variant];

  return (
    <div className={cn(
      "text-center px-4 py-2 rounded-lg border",
      style.bg,
      style.border
    )}>
      <span className={cn("text-xl font-bold tabular-nums block", style.text)}>
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
```

## Resultado Visual

| Card | Antes | Depois |
|------|-------|--------|
| **Total** | Borda cinza, bg neutro | Sem alteração (neutro) |
| **Aprovadas** | Texto verde (emerald-400) | Texto azul (sky-400), borda azul sutil, bg azul 10% |
| **Falhas** | Texto rosa (rose-400) | Texto rosa, borda rosa sutil, bg rosa 10% |

## Paleta de Cores Aplicada

- **Aprovadas**: `sky-400` (texto), `sky-500/30` (borda), `sky-500/10` (background)
- **Falhas**: `rose-400` (texto), `rose-500/30` (borda), `rose-500/10` (background)
- **Total**: Mantém estilo neutro para contraste

