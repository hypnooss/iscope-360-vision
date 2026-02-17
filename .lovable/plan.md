

# Corrigir tooltip do badge "+N" -- adotar mesmo padrao do IP

## Problema

O tooltip do badge "+N" nao aparece mais apos a mudanca do Portal. O tooltip do IP Address funciona porque envolve o badge em um `<span className="inline-flex cursor-help">` dentro do `TooltipTrigger`. O badge "+N" passa o `Badge` diretamente ao `TooltipTrigger asChild`, e o componente `Badge` nao repassa corretamente o ref/eventos necessarios pelo Radix.

## Mudanca

**Arquivo:** `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` (linhas 1062-1063)

Envolver o `Badge` do "+N" em um `<span>`, identico ao padrao do IP:

```text
Antes:
  <TooltipTrigger asChild>
    <Badge ...>+{overflowTechs}</Badge>
  </TooltipTrigger>

Depois:
  <TooltipTrigger asChild>
    <span className="inline-flex cursor-help">
      <Badge ...>+{overflowTechs}</Badge>
    </span>
  </TooltipTrigger>
```

Nenhum outro arquivo precisa ser alterado.

