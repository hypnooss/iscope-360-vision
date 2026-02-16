

# Padronizar titulo e subtitulo do Analyzer

## O que muda

O header do Attack Surface Analyzer sera ajustado para seguir o mesmo padrao visual das paginas "Dominios Externos" e "Execucoes":

| Aspecto | Atual (Analyzer) | Padrao (outras paginas) |
|---|---|---|
| Titulo | `text-2xl font-bold flex items-center gap-2` + icone Radar | `text-2xl font-bold text-foreground` sem icone |
| Texto titulo | "Attack Surface Analyzer" | "Surface Analyzer" |
| Subtitulo | `text-muted-foreground text-sm mt-1` | `text-muted-foreground` (sem text-sm, sem mt-1) |
| Texto subtitulo | "Visao consolidada de ativos expostos -- organizada por risco" | "Visao consolidada de ativos expostos" |

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` (linhas 1234-1240)

**De:**
```html
<h1 className="text-2xl font-bold flex items-center gap-2">
  <Radar className="w-7 h-7 text-teal-400" />
  Attack Surface Analyzer
</h1>
<p className="text-muted-foreground text-sm mt-1">
  Visao consolidada de ativos expostos -- organizada por risco
</p>
```

**Para:**
```html
<h1 className="text-2xl font-bold text-foreground">Surface Analyzer</h1>
<p className="text-muted-foreground">Visao consolidada de ativos expostos</p>
```

Mudanca unica em um arquivo. O import do `Radar` pode ser mantido caso seja usado em outro lugar do componente.

